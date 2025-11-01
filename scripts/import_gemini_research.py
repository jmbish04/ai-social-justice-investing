#!/usr/bin/env python3
"""Utility for importing Gemini research data into the Renegade Capital pipeline."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
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


class RenegadeApiClient:
    """Small wrapper around the Worker API for creating guests, episodes, and workflows."""

    def __init__(self, base_url: str, admin_token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.admin_token = admin_token

    def list_guest_profiles(self) -> List[Dict[str, object]]:
        payload = self._request('GET', '/api/guest-profiles')
        if not isinstance(payload, dict) or not payload.get('success'):
            raise ApiError(None, f"Unexpected response: {payload}", self._url('/api/guest-profiles'))
        return list(payload.get('data') or [])

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

    def trigger_audio_generation(self, episode_id: str) -> Dict[str, object]:
        payload = self._request('POST', f'/api/episodes/{episode_id}/generate-audio', {})
        if not isinstance(payload, dict):
            raise ApiError(None, f"Unexpected audio response: {payload}", self._url(f'/api/episodes/{episode_id}/generate-audio'))
        return payload

    def _request(self, method: str, path: str, payload: Optional[Dict[str, object]] = None) -> object:
        url = self._url(path)
        headers = {'Accept': 'application/json'}
        data: Optional[bytes] = None
        if payload is not None:
            data = json.dumps({k: v for k, v in payload.items() if v is not None}).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        if self.admin_token:
            headers['Authorization'] = f'Bearer {self.admin_token}'
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
    pattern = re.compile(
        r"\| Guest Name \| Domain \| Relevance Summary \|\n(?P<table>(?:\|.*\n)+?)\n\s*Detailed Guest Profiles",
        re.MULTILINE,
    )
    match = pattern.search(text)
    if not match:
        raise ValueError('Could not locate the guest prospectus table in the research document.')
    table_text = match.group('table')
    guests: Dict[str, Dict[str, str]] = {}
    for line in table_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('|---'):
            continue
        columns = [col.strip() for col in stripped.split('|')[1:-1]]
        if len(columns) != 3:
            continue
        name, domain, summary = columns
        guests[name] = {'domain': domain, 'summary': summary}
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
    pairs = re.findall(r"(.+?)\s*\(([^)]+)\)", raw)
    results: List[Tuple[str, Optional[str]]] = []
    for name, descriptor in pairs:
        clean_name = name.strip().rstrip('+').strip()
        results.append((clean_name, descriptor.strip()))
    if not results:
        tokens = re.split(r"\+|,| and ", raw)
        for token in tokens:
            cleaned = token.strip().strip('.')
            if cleaned:
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
    existing_by_name = {str(profile['name']).strip(): profile for profile in existing_profiles}
    guest_ids: Dict[str, str] = {}

    for spec in guests:
        existing = existing_by_name.get(spec.name)
        if existing:
            guest_ids[spec.name] = str(existing['id'])
            continue
        created = client.create_guest_profile(spec)
        guest_ids[spec.name] = str(created['id'])
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
    parser.add_argument('--base-url', default=os.environ.get('API_BASE_URL', 'http://127.0.0.1:8787'), help='Base URL for the Cloudflare Worker API (default: %(default)s).')
    parser.add_argument('--token', default=os.environ.get('ADMIN_TOKEN'), help='Admin token for authenticated routes. Reads ADMIN_TOKEN if omitted.')
    parser.add_argument('--research-path', default='docs/GUEST_RESEARCH.md', help='Path to the Gemini research markdown document.')
    parser.add_argument('--skip-audio', action='store_true', help='Do not trigger audio generation for the first episode.')
    args = parser.parse_args(argv)

    research_path = Path(args.research_path)
    if not research_path.exists():
        print(f"Research file not found at {research_path}", file=sys.stderr)
        return 1

    guests, _, episodes = load_research(research_path)
    if not episodes:
        print('No episode definitions could be parsed from the research file.', file=sys.stderr)
        return 1

    client = RenegadeApiClient(args.base_url, args.token)
    guest_ids = sync_guest_profiles(client, guests)

    created_episodes = create_episodes_with_guests(client, episodes, guest_ids)

    print('Created or verified guest profiles:')
    for name, guest_id in guest_ids.items():
        print(f"  - {name}: {guest_id}")

    print('\nCreated episodes:')
    for spec, episode in created_episodes:
        print(f"  - {spec.title} (ID: {episode['id']}) -> Guests: {', '.join(spec.guest_names)}")

    if not args.skip_audio and created_episodes:
        first_episode_id = str(created_episodes[0][1]['id'])
        print(f"\nTriggering transcript and audio generation for episode ID {first_episode_id}...")
        audio_response = client.trigger_audio_generation(first_episode_id)
        print(json.dumps(audio_response, indent=2))
    else:
        print('\nAudio generation skipped.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
