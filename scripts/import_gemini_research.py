#!/usr/bin/env python3
"""Utility for importing Gemini research data into the Renegade Capital pipeline."""

from __future__ import annotations

import argparse
import atexit
import json
import os
import re
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib import error, request
import urllib.parse


@dataclass
class GuestProfileSpec:
    """Structured representation of a guest profile extracted from research."""

    name: str
    persona_description: str
    expertise: Optional[str]
    tone: Optional[str]
    background: Optional[str]
    potential_topic: Optional[str] = None
    summary: Optional[str] = None


@dataclass
class EpisodeSpec:
    """Structured representation of an episode definition derived from research."""

    title: str
    description: str
    guest_names: List[str]
    theme: str
    notes: Dict[str, str] = field(default_factory=dict)


class ApiError(RuntimeError):
    """Raised when the Cloudflare Worker API returns an error."""

    def __init__(self, status: Optional[int], message: str, url: str):
        super().__init__(f"{status or 'ERR'}: {message} ({url})")
        self.status = status
        self.message = message
        self.url = url


class WranglerDevManager:
    """Manages the lifecycle of a wrangler dev process."""

    def __init__(self, project_root: Path, port: int = 8787):
        self.project_root = project_root
        self.port = port
        self.process: Optional[subprocess.Popen[str]] = None
        self._registered_cleanup = False

    def start(self, timeout: int = 60) -> None:
        """Start wrangler dev and wait for it to be ready."""
        if self.process is not None:
            return

        print(f"Starting wrangler dev on port {self.port}...", file=sys.stderr)
        self.process = subprocess.Popen(
            ['npx', 'wrangler', 'dev', '--port', str(self.port)],
            cwd=str(self.project_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self._register_cleanup()

        base_url = f"http://127.0.0.1:{self.port}"
        print(f"Waiting for wrangler dev to be ready at {base_url}...", file=sys.stderr)

        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.process.poll() is not None:
                # Process exited, read any available output
                output_lines = []
                if self.process.stdout:
                    try:
                        for line in self.process.stdout:
                            output_lines.append(line.rstrip())
                    except Exception:
                        pass
                output = '\n'.join(output_lines) if output_lines else '(no output)'
                raise RuntimeError(
                    f"wrangler dev exited early with code {self.process.returncode}:\n{output}"
                )
            try:
                req = request.Request(f"{base_url}/", method='GET')
                with request.urlopen(req, timeout=2) as resp:
                    if resp.status == 200 or resp.status == 404:
                        print(f"wrangler dev is ready at {base_url}", file=sys.stderr)
                        return
            except (error.URLError, OSError):
                time.sleep(1)

        raise RuntimeError(f"wrangler dev failed to become ready within {timeout} seconds")

    def stop(self) -> None:
        """Stop the wrangler dev process."""
        if self.process is None:
            return

        print("\nStopping wrangler dev...", file=sys.stderr)
        try:
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait()
        except Exception as exc:
            print(f"Warning: Error stopping wrangler dev: {exc}", file=sys.stderr)
        finally:
            self.process = None

    def _register_cleanup(self) -> None:
        """Register cleanup handlers."""
        if self._registered_cleanup:
            return
        atexit.register(self.stop)

        def signal_handler(_signum: int, _frame: object) -> None:
            self.stop()
            sys.exit(1)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        self._registered_cleanup = True

    def __enter__(self) -> 'WranglerDevManager':
        """Context manager entry."""
        return self

    def __exit__(self, exc_type: Optional[type], exc_val: Optional[BaseException], exc_tb: Optional[object]) -> None:
        """Context manager exit."""
        self.stop()


class RenegadeApiClient:
    """Small wrapper around the Worker API for creating guests, episodes, and workflows."""

    def __init__(self, base_url: str = "https://social-investing.hacolby.workers.dev", admin_token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.admin_token = admin_token

    def list_guest_profiles(self) -> List[Dict[str, object]]:
        payload = self._request('GET', '/api/guest-profiles')
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Unexpected response: {payload}", self._url('/api/guest-profiles'))
        profiles = list(payload.get('data') or [])
        # Additional client-side deduplication as backup
        seen = {}
        deduplicated = []
        for profile in profiles:
            key = str(profile.get('name', '')).strip().lower()
            if key and key not in seen:
                seen[key] = profile
                deduplicated.append(profile)
        return deduplicated

    def create_guest_profile(self, spec: GuestProfileSpec) -> Dict[str, object]:
        body = {
            'name': spec.name,
            'persona_description': spec.persona_description,
            'expertise': spec.expertise,
            'tone': spec.tone,
            'background': spec.background,
        }
        payload = self._request('POST', '/api/guest-profiles', body)
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Failed to create guest {spec.name}: {payload}", self._url('/api/guest-profiles'))
        return payload['data']

    def create_episode(self, title: str, description: str) -> Dict[str, object]:
        body = {'title': title, 'description': description}
        payload = self._request('POST', '/api/episodes', body)
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Failed to create episode {title}: {payload}", self._url('/api/episodes'))
        return payload['data']

    def add_guest_to_episode(self, episode_id: str, guest_profile_id: str) -> None:
        body = {'guestProfileId': guest_profile_id}
        payload = self._request('POST', f'/api/episodes/{episode_id}/guests', body)
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Failed to add guest {guest_profile_id} to episode {episode_id}: {payload}", self._url(f'/api/episodes/{episode_id}/guests'))

    def generate_transcript(self, episode_id: str) -> Dict[str, object]:
        """Generate a transcript for an episode using AI agents."""
        payload = self._request('POST', f'/api/episodes/{episode_id}/generate-transcript', {})
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Failed to generate transcript: {payload}", self._url(f'/api/episodes/{episode_id}/generate-transcript'))
        return payload

    def trigger_audio_generation(self, episode_id: str) -> Dict[str, object]:
        """Trigger audio generation for an episode."""
        payload = self._request('POST', f'/api/episodes/{episode_id}/generate-audio', {})
        if not isinstance(payload, dict):
            raise ApiError(None, f"Unexpected audio response: {payload}", self._url(f'/api/episodes/{episode_id}/generate-audio'))
        return payload

    def get_workflow_status(self, episode_id: str) -> Dict[str, object]:
        """Get workflow status for an episode."""
        payload = self._request('GET', f'/api/episodes/{episode_id}/workflow-status', None)
        if not isinstance(payload, dict):
            raise ApiError(None, f"Unexpected status response: {payload}", self._url(f'/api/episodes/{episode_id}/workflow-status'))
        return payload

    def _request(self, method: str, path: str, payload: Optional[Dict[str, object]] = None) -> object:
        url = self._url(path)
        headers = {'Accept': 'application/json'}
        data: Optional[bytes] = None
        if payload is not None:
            data = json.dumps({k: v for k, v in payload.items() if v is not None}).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        # Authentication removed - public API
        # if self.admin_token:
        #     headers['Authorization'] = f'Bearer {self.admin_token}'
        req = request.Request(url, data=data, headers=headers, method=method)
        try:
            with request.urlopen(req) as resp:
                body = resp.read()
                if not body:
                    return {}
                return json.loads(body.decode('utf-8'))
        except error.HTTPError as http_err:
            raw = http_err.read().decode('utf-8')
            try:
                parsed = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                parsed = {'error': raw or http_err.reason}
            message = parsed.get('error') if isinstance(parsed, dict) else str(parsed)
            raise ApiError(http_err.code, message or http_err.reason, url) from None
        except error.URLError as url_err:
            raise ApiError(None, str(url_err.reason), url) from None

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"


def parse_guest_table(text: str) -> Dict[str, Dict[str, str]]:
    """Parse guest table from markdown. Handles various table formats."""
    # Find the header row
    header_match = re.search(r'\| Guest Name \| Domain \| Relevance Summary \|', text)
    if not header_match:
        raise ValueError(
            'Could not locate guest table header. Expected: | Guest Name | Domain | Relevance Summary |'
        )
    
    # Find where "Detailed Guest Profiles" section starts
    detailed_start = text.find('Detailed Guest Profiles', header_match.end())
    if detailed_start == -1:
        raise ValueError('Could not locate "Detailed Guest Profiles" section after the table.')
    
    # Extract table rows between header and "Detailed Guest Profiles"
    table_section = text[header_match.end():detailed_start]
    
    guests: Dict[str, Dict[str, str]] = {}
    for line in table_section.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # Skip separator rows (|---|---|)
        if stripped.startswith('|---'):
            continue
        # Parse table row
        if '|' in stripped:
            columns = [col.strip() for col in stripped.split('|')[1:-1]]
            if len(columns) >= 2:
                name = columns[0]
                domain = columns[1] if len(columns) > 1 else ''
                summary = columns[2] if len(columns) > 2 else ''
                # Skip header row if we encounter it again
                if name and name.lower() not in ('guest name', 'name'):
                    guests[name] = {'domain': domain, 'summary': summary}
    
    if not guests:
        raise ValueError(
            'Found guest table header but could not parse any guest rows. '
            'Expected markdown table rows between header and "Detailed Guest Profiles" section.'
        )
    
    return guests


def parse_structured_section(lines: Iterable[str]) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    current_key: Optional[str] = None
    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            continue
        if stripped.startswith('* '):
            content = stripped[2:].strip()
            if ': ' in content:
                key, value = content.split(':', 1)
                current_key = key.strip()
                fields[current_key] = value.strip()
            else:
                current_key = None
        elif current_key:
            fields[current_key] = f"{fields[current_key]} {stripped}".strip()
    return fields


def parse_guest_details(text: str) -> Dict[str, Dict[str, str]]:
    if 'Detailed Guest Profiles' not in text:
        return {}
    details_text = text.split('Detailed Guest Profiles', 1)[1]
    if 'IV. Strategic Analysis' in details_text:
        details_text = details_text.split('IV. Strategic Analysis', 1)[0]
    sections = re.split(r"\n(?=\d+\.\s)", details_text.strip())
    details: Dict[str, Dict[str, str]] = {}
    for section in sections:
        block = section.strip()
        if not block:
            continue
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        header = lines[0]
        match = re.match(r"\d+\.\s+(.*)", header)
        if not match:
            continue
        name = match.group(1).strip()
        fields = parse_structured_section(lines[1:])
        details[name] = fields
    return details


def build_guest_profiles(table: Dict[str, Dict[str, str]], details: Dict[str, Dict[str, str]]) -> Tuple[List[GuestProfileSpec], Dict[str, GuestProfileSpec]]:
    profiles: List[GuestProfileSpec] = []
    by_name: Dict[str, GuestProfileSpec] = {}

    def assemble_profile(name: str, info: Dict[str, str], table_entry: Optional[Dict[str, str]] = None) -> GuestProfileSpec:
        domain = info.get('Domain') or (table_entry or {}).get('domain')
        rationale = info.get('Rationale')
        summary = (table_entry or {}).get('summary')
        chemistry = info.get('Chemistry Tag')
        potential = info.get('Potential Topic')
        persona_parts = [part for part in [summary, rationale] if part]
        if chemistry:
            persona_parts.append(f"Chemistry Tag: {chemistry}")
        if potential:
            persona_parts.append(f"Potential Topic: {potential}")
        persona_description = ' '.join(persona_parts).strip()
        background_parts = []
        audience = info.get('Audience Type')
        influence = info.get('Influence Level')
        if audience:
            background_parts.append(f"Audience: {audience}")
        if influence:
            background_parts.append(f"Influence: {influence}")
        background = ' | '.join(background_parts) or None
        spec = GuestProfileSpec(
            name=name,
            persona_description=persona_description,
            expertise=domain,
            tone=chemistry,
            background=background,
            potential_topic=potential,
            summary=summary or rationale,
        )
        return spec

    for name, table_entry in table.items():
        detail_entry = details.get(name, {})
        spec = assemble_profile(name, detail_entry, table_entry)
        profiles.append(spec)
        by_name[name] = spec

    for name, detail_entry in details.items():
        if name in by_name:
            continue
        spec = assemble_profile(name, detail_entry, None)
        profiles.append(spec)
        by_name[name] = spec

    return profiles, by_name


def extract_name_descriptor_pairs(raw: str) -> List[Tuple[str, Optional[str]]]:
    """Extract guest names from pairing strings, handling various formats."""
    pairs = re.findall(r"(.+?)\s*\(([^)]+)\)", raw)
    results: List[Tuple[str, Optional[str]]] = []
    for name, descriptor in pairs:
        # Clean name: remove leading +, commas, "and", whitespace
        clean_name = re.sub(r'^[\s+,]+|[\s+,]+$', '', name.strip())
        clean_name = re.sub(r'^\s*and\s+', '', clean_name, flags=re.IGNORECASE)
        if clean_name:
            results.append((clean_name, descriptor.strip()))
    
    if not results:
        # Split on common separators: +, comma, "and"
        tokens = re.split(r'\s*\+|\s*,\s*|\s+and\s+', raw)
        for token in tokens:
            # Clean each token: remove leading/trailing punctuation and whitespace
            cleaned = re.sub(r'^[\s+,]+|[\s+,.]+$', '', token.strip())
            cleaned = re.sub(r'^\s*and\s+', '', cleaned, flags=re.IGNORECASE)
            if cleaned and len(cleaned) > 2:  # Filter out very short tokens
                results.append((cleaned, None))
    return results


def first_sentence(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip()) if text else []
    return sentences[0].rstrip('. ') if sentences else ''


def build_sentence_map(narrative: str, names: List[str]) -> Dict[str, str]:
    sentences = re.split(r"(?<=[.!?])\s+", narrative.strip()) if narrative else []
    mapping: Dict[str, str] = {}
    for name in names:
        relevant = [sentence for sentence in sentences if name in sentence]
        if relevant:
            mapping[name] = ' '.join(relevant)
    return mapping


def parse_episode_specs(text: str) -> List[EpisodeSpec]:
    try:
        start_idx = text.index('1. Thematic Pairing:')
        thematic_block = text[start_idx:]
    except ValueError:
        return []

    sections = re.split(r"\n(?=\d+\.\s+Thematic)", thematic_block.strip())
    episodes: List[EpisodeSpec] = []

    for section in sections:
        block = section.strip()
        if not block:
            continue
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        header = lines[0]
        fields = parse_structured_section(lines[1:])

        if 'Thematic Pairing' in header:
            theme = header.split(':', 1)[1].strip()
            concept = fields.get('Concept', '').strip()
            engineered = fields.get('Engineered Dialogue', '').strip()
            raw_pairing = fields.get('Proposed Pairing', '')
            guests = extract_name_descriptor_pairs(raw_pairing)
            guest_names = [name for name, _ in guests]
            subtitle = first_sentence(concept)
            title = f"{theme}: {subtitle}" if subtitle else theme
            descriptor_text = ' & '.join(
                f"{name} ({descriptor})" if descriptor else name for name, descriptor in guests
            )
            description_parts = [concept, engineered]
            if descriptor_text:
                description_parts.append(f"Featuring {descriptor_text}.")
            description = ' '.join(part for part in description_parts if part).strip()
            episodes.append(
                EpisodeSpec(
                  title=title,
                  description=description,
                  guest_names=guest_names,
                  theme=theme,
                  notes={'pairing': raw_pairing, 'concept': concept, 'engineered': engineered},
                )
            )
        elif 'Thematic Arc' in header:
            theme = header.split(':', 1)[1].strip()
            concept = fields.get('Concept', '').strip()
            raw_guests = fields.get('Guests', '')
            narrative = fields.get('Narrative Flow', '').strip()
            guests = extract_name_descriptor_pairs(raw_guests)
            guest_names = [name for name, _ in guests]
            sentence_map = build_sentence_map(narrative, guest_names)
            for idx, (name, descriptor) in enumerate(guests, start=1):
                part_title = descriptor or f"Conversation with {name}"
                title = f"{theme} (Part {idx}): {part_title}"
                description_parts = [concept]
                if sentence_map.get(name):
                    description_parts.append(sentence_map[name])
                description_parts.append(f"Featuring {name}.")
                description = ' '.join(part for part in description_parts if part).strip()
                episodes.append(
                    EpisodeSpec(
                        title=title,
                        description=description,
                        guest_names=[name],
                        theme=theme,
                        notes={'concept': concept, 'narrative': narrative, 'part': str(idx)},
                    )
                )

    return episodes


def load_research(path: Path) -> Tuple[List[GuestProfileSpec], Dict[str, GuestProfileSpec], List[EpisodeSpec]]:
    text = path.read_text(encoding='utf-8')
    table = parse_guest_table(text)
    details = parse_guest_details(text)
    guests, guest_map = build_guest_profiles(table, details)
    episodes = parse_episode_specs(text)
    return guests, guest_map, episodes


def sync_guest_profiles(client: RenegadeApiClient, guests: List[GuestProfileSpec]) -> Dict[str, str]:
    existing_profiles = client.list_guest_profiles()
    # Use case-insensitive matching for deduplication
    existing_by_name = {
        str(profile['name']).strip().lower(): profile 
        for profile in existing_profiles
    }
    guest_ids: Dict[str, str] = {}

    for spec in guests:
        # Normalize name for case-insensitive lookup
        normalized_name = spec.name.strip().lower()
        existing = existing_by_name.get(normalized_name)
        if existing:
            guest_ids[spec.name] = str(existing['id'])
            print(f"  ✓ Using existing guest: {spec.name} (ID: {existing['id']})")
            continue
        # Create new guest (API will handle deduplication if race condition occurs)
        created = client.create_guest_profile(spec)
        guest_ids[spec.name] = str(created['id'])
        print(f"  ✓ Created new guest: {spec.name} (ID: {created['id']})")
    return guest_ids


def create_episodes_with_guests(client: RenegadeApiClient, episodes: List[EpisodeSpec], guest_ids: Dict[str, str]) -> List[Tuple[EpisodeSpec, Dict[str, object]]]:
    created: List[Tuple[EpisodeSpec, Dict[str, object]]] = []
    for spec in episodes:
        episode = client.create_episode(spec.title, spec.description)
        episode_id = str(episode['id'])
        for guest_name in spec.guest_names:
            guest_id = guest_ids.get(guest_name)
            if not guest_id:
                print(f"[WARN] Guest '{guest_name}' was not created; skipping association for episode '{spec.title}'.", file=sys.stderr)
                continue
            try:
                client.add_guest_to_episode(episode_id, guest_id)
            except ApiError as exc:
                if exc.status == 500 and 'UNIQUE' in exc.message.upper():
                    print(f"[INFO] Guest '{guest_name}' already linked to episode '{spec.title}'.", file=sys.stderr)
                else:
                    raise
        created.append((spec, episode))
    return created


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Import Gemini research data into the Renegade Capital system.')
    parser.add_argument('--base-url', default='https://social-investing.hacolby.workers.dev', help='Base URL for the Cloudflare Worker API (default: https://social-investing.hacolby.workers.dev)')
    parser.add_argument('--token', default=None, help='Optional token (deprecated - no authentication required).')
    parser.add_argument('--research-path', default='docs/GUEST_RESEARCH.md', help='Path to the Gemini research markdown document.')
    parser.add_argument('--skip-transcript', action='store_true', help='Do not generate transcript for episodes.')
    parser.add_argument('--skip-audio', action='store_true', help='Do not trigger audio generation for episodes.')
    parser.add_argument('--generate-all', action='store_true', help='Generate transcript and audio for all created episodes (not just the first).')
    parser.add_argument('--start-dev', action='store_true', help='Start wrangler dev before importing. Stops it when done.')
    parser.add_argument('--dev-timeout', type=int, default=60, help='Timeout in seconds for wrangler dev to become ready (default: 60).')
    parser.add_argument('--dev-port', type=int, default=8787, help='Port for wrangler dev (default: 8787).')
    args = parser.parse_args(argv)

    # Determine project root (parent of scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    # Determine base URL - default to production, override if starting dev server
    if args.start_dev:
        base_url = f"http://127.0.0.1:{args.dev_port}"
    elif args.base_url:
        base_url = args.base_url
    else:
        # Default to production URL (hardcoded)
        base_url = 'https://social-investing.hacolby.workers.dev'

    # Start wrangler dev if requested
    dev_manager: Optional[WranglerDevManager] = None
    if args.start_dev:
        dev_manager = WranglerDevManager(project_root, port=args.dev_port)
        try:
            dev_manager.start(timeout=args.dev_timeout)
        except Exception as exc:
            print(f"Failed to start wrangler dev: {exc}", file=sys.stderr)
            return 1

    try:
        research_path = Path(args.research_path)
        if not research_path.is_absolute():
            research_path = project_root / research_path

        if not research_path.exists():
            print(f"Research file not found at {research_path}", file=sys.stderr)
            return 1

        guests, guest_map, episodes = load_research(research_path)
        if not episodes:
            print('No episode definitions could be parsed from the research file.', file=sys.stderr)
            return 1

        client = RenegadeApiClient(base_url, args.token)
        guest_ids = sync_guest_profiles(client, guests)

        created_episodes = create_episodes_with_guests(client, episodes, guest_ids)

        print('Created or verified guest profiles:')
        for name, guest_id in guest_ids.items():
            print(f"  - {name}: {guest_id}")

        print('\nCreated episodes:')
        for spec, episode in created_episodes:
            print(f"  - {spec.title} (ID: {episode['id']}) -> Guests: {', '.join(spec.guest_names)}")

        # Generate transcripts and audio if requested
        episodes_to_process = created_episodes if args.generate_all else created_episodes[:1]
        
        if not args.skip_transcript and episodes_to_process:
            print(f'\n{"="*60}')
            print(f'Generating transcripts for {len(episodes_to_process)} episode(s)...')
            print(f'{"="*60}')
            
            for spec, episode in episodes_to_process:
                episode_id = str(episode['id'])
                try:
                    print(f"\n[Episode: {spec.title}] Generating transcript...")
                    transcript_response = client.generate_transcript(episode_id)
                    if transcript_response.get('success'):
                        transcript_data = transcript_response.get('data', {})
                        word_count = transcript_data.get('wordCount', 0)
                        print(f"  ✓ Transcript generated: {word_count} words, version {transcript_data.get('transcript', {}).get('version', '?')}")
                    else:
                        print(f"  ✗ Failed: {transcript_response.get('error', 'Unknown error')}")
                except ApiError as exc:
                    print(f"  ✗ Error: {exc.message}")
                except Exception as exc:
                    print(f"  ✗ Unexpected error: {exc}")
        
        if not args.skip_audio and episodes_to_process:
            print(f'\n{"="*60}')
            print(f'Triggering audio generation for {len(episodes_to_process)} episode(s)...')
            print(f'{"="*60}')
            
            for spec, episode in episodes_to_process:
                episode_id = str(episode['id'])
                try:
                    print(f"\n[Episode: {spec.title}] Starting audio generation workflow...")
                    audio_response = client.trigger_audio_generation(episode_id)
                    if audio_response.get('success') or audio_response.get('ok'):
                        status_endpoint = audio_response.get('data', {}).get('statusEndpoint', '')
                        print(f"  ✓ Workflow started. Monitor status at: {status_endpoint}")
                        print(f"  Response: {json.dumps(audio_response, indent=4)}")
                    else:
                        print(f"  ✗ Failed: {audio_response.get('error', 'Unknown error')}")
                except ApiError as exc:
                    print(f"  ✗ Error: {exc.message}")
                except Exception as exc:
                    print(f"  ✗ Unexpected error: {exc}")
        
        if args.skip_transcript and args.skip_audio:
            print('\nTranscript and audio generation skipped (use --generate-all to process all episodes).')

        return 0
    finally:
        if dev_manager is not None:
            dev_manager.stop()


if __name__ == '__main__':
    raise SystemExit(main())
