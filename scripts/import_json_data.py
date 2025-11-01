#!/usr/bin/env python3
"""
Import JSON data files into D1 database via API.
Migrates episodes.json, research.json, and pairings.json to the database.

Usage:
    python3 scripts/import_json_data.py [--base-url URL] [--dry-run]
"""

import json
import os
import sys
import argparse
from typing import Dict, List, Optional, Any
from urllib import request, error
from datetime import datetime


class ApiClient:
    """Client for interacting with the Cloudflare Worker API."""
    
    def __init__(self, base_url: str = "https://social-investing.hacolby.workers.dev"):
        self.base_url = base_url.rstrip('/')
        if not self.base_url.startswith('http'):
            self.base_url = f'https://{self.base_url}'
    
    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make an API request."""
        url = f"{self.base_url}{path}"
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
        data = None
        
        if payload:
            data = json.dumps(payload).encode('utf-8')
        
        req = request.Request(url, data=data, headers=headers, method=method)
        
        try:
            with request.urlopen(req) as resp:
                body = resp.read()
                if body:
                    return json.loads(body.decode('utf-8'))
                return {}
        except error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else 'Unknown error'
            raise Exception(f"HTTP {e.code}: {error_body}")
        except error.URLError as e:
            raise Exception(f"Connection error: {e.reason}")
    
    def create_episode(self, episode: Dict[str, Any]) -> Dict[str, Any]:
        """Create an episode via API."""
        payload = {
            'title': episode['title'],
            'description': episode.get('description', ''),
        }
        # Preserve the original ID if provided
        if 'id' in episode:
            payload['id'] = episode['id']
        # Include status if provided
        if 'status' in episode:
            payload['status'] = episode['status']
        return self._request('POST', '/api/episodes', payload)
    
    def create_research(self, research: Dict[str, Any]) -> Dict[str, Any]:
        """Create a research entry via API."""
        payload = {
            'name': research['name'],
            'domain': research.get('domain', ''),
            'chemistry': research.get('chemistry', ''),
            'topic': research.get('topic', ''),
            'link': research.get('link', ''),
        }
        if 'dateAdded' in research:
            payload['dateAdded'] = research['dateAdded']
        return self._request('POST', '/api/research', payload)
    
    def create_pairing(self, pairing: Dict[str, Any]) -> Dict[str, Any]:
        """Create a pairing via API."""
        payload = {
            'guestName': pairing['guestName'],
            'authorName': pairing['authorName'],
            'chemistry': pairing.get('chemistry', []),
            'topic': pairing.get('topic', ''),
            'reasoning': pairing.get('reasoning', ''),
        }
        if 'confidenceScore' in pairing:
            payload['confidenceScore'] = pairing['confidenceScore']
        return self._request('POST', '/api/pairings', payload)
    
    def update_episode(self, episode_id: str, episode: Dict[str, Any]) -> Dict[str, Any]:
        """Update an episode via API."""
        payload = {
            'title': episode['title'],
            'description': episode.get('description', ''),
        }
        if 'status' in episode:
            payload['status'] = episode['status']
        return self._request('PUT', f'/api/episodes/{episode_id}', payload)


def date_to_timestamp(date_str: Optional[str]) -> Optional[int]:
    """Convert YYYY-MM-DD date string to Unix timestamp."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        return int(dt.timestamp() * 1000)  # Convert to milliseconds
    except ValueError:
        return None


def import_episodes(client: ApiClient, data_dir: str, dry_run: bool = False) -> Dict[str, int]:
    """Import episodes from episodes.json."""
    episodes_file = os.path.join(data_dir, 'episodes.json')
    
    if not os.path.exists(episodes_file):
        print(f"⚠️  Episodes file not found: {episodes_file}")
        return {'created': 0, 'updated': 0, 'skipped': 0}
    
    with open(episodes_file, 'r') as f:
        episodes = json.load(f)
    
    print(f"\n📺 Importing {len(episodes)} episodes...")
    
    created = 0
    updated = 0
    skipped = 0
    
    for episode in episodes:
        episode_id = episode.get('id')
        title = episode.get('title', 'Untitled')
        
        if dry_run:
            print(f"  [DRY RUN] Would create/update episode: {title} (ID: {episode_id})")
            created += 1
            continue
        
        try:
            # Try to create first
            result = client.create_episode(episode)
            if result.get('success'):
                created += 1
                print(f"  ✓ Created: {title}")
            else:
                # If creation fails, try update
                if episode_id:
                    result = client.update_episode(episode_id, episode)
                    if result.get('success'):
                        updated += 1
                        print(f"  ✓ Updated: {title}")
                    else:
                        skipped += 1
                        print(f"  ✗ Skipped: {title} - {result.get('error', 'Unknown error')}")
                else:
                    skipped += 1
                    print(f"  ✗ Skipped: {title} - No ID")
        except Exception as e:
            skipped += 1
            print(f"  ✗ Error with {title}: {e}")
    
    return {'created': created, 'updated': updated, 'skipped': skipped}


def import_research(client: ApiClient, data_dir: str, dry_run: bool = False) -> Dict[str, int]:
    """Import research entries from research.json."""
    research_file = os.path.join(data_dir, 'research.json')
    
    if not os.path.exists(research_file):
        print(f"⚠️  Research file not found: {research_file}")
        return {'created': 0, 'skipped': 0}
    
    with open(research_file, 'r') as f:
        research_entries = json.load(f)
    
    print(f"\n🔬 Importing {len(research_entries)} research entries...")
    
    created = 0
    skipped = 0
    
    for entry in research_entries:
        name = entry.get('name', 'Unknown')
        
        if dry_run:
            print(f"  [DRY RUN] Would create research entry: {name}")
            created += 1
            continue
        
        try:
            result = client.create_research(entry)
            if result.get('success'):
                created += 1
                print(f"  ✓ Created: {name}")
            else:
                skipped += 1
                error_msg = result.get('error', 'Unknown error')
                print(f"  ✗ Skipped: {name} - {error_msg}")
        except Exception as e:
            skipped += 1
            print(f"  ✗ Error with {name}: {e}")
    
    return {'created': created, 'skipped': skipped}


def import_pairings(client: ApiClient, data_dir: str, dry_run: bool = False) -> Dict[str, int]:
    """Import pairings from pairings.json."""
    pairings_file = os.path.join(data_dir, 'pairings.json')
    
    if not os.path.exists(pairings_file):
        print(f"⚠️  Pairings file not found: {pairings_file}")
        return {'created': 0, 'skipped': 0}
    
    with open(pairings_file, 'r') as f:
        pairings = json.load(f)
    
    print(f"\n🤝 Importing {len(pairings)} pairings...")
    
    created = 0
    skipped = 0
    
    for pairing in pairings:
        guest = pairing.get('guestName', 'Unknown')
        author = pairing.get('authorName', 'Unknown')
        
        if dry_run:
            print(f"  [DRY RUN] Would create pairing: {guest} + {author}")
            created += 1
            continue
        
        try:
            result = client.create_pairing(pairing)
            if result.get('success'):
                created += 1
                print(f"  ✓ Created: {guest} + {author}")
            else:
                skipped += 1
                error_msg = result.get('error', 'Unknown error')
                print(f"  ✗ Skipped: {guest} + {author} - {error_msg}")
        except Exception as e:
            skipped += 1
            print(f"  ✗ Error with {guest} + {author}: {e}")
    
    return {'created': created, 'skipped': skipped}


def main():
    parser = argparse.ArgumentParser(
        description='Import JSON data files into D1 database via API'
    )
    parser.add_argument(
        '--base-url',
        default=os.environ.get('API_BASE_URL', 'https://social-investing.hacolby.workers.dev'),
        help='Base URL for the Cloudflare Worker API (default: https://social-investing.hacolby.workers.dev or API_BASE_URL env var)'
    )
    parser.add_argument(
        '--data-dir',
        default='src/data',
        help='Directory containing JSON data files (default: src/data)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be imported without actually importing'
    )
    parser.add_argument(
        '--skip-episodes',
        action='store_true',
        help='Skip importing episodes'
    )
    parser.add_argument(
        '--skip-research',
        action='store_true',
        help='Skip importing research entries'
    )
    parser.add_argument(
        '--skip-pairings',
        action='store_true',
        help='Skip importing pairings'
    )
    
    args = parser.parse_args()
    
    print("🚀 JSON Data Import Script")
    print("=" * 60)
    print(f"Base URL: {args.base_url}")
    print(f"Data Directory: {args.data_dir}")
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No data will be imported")
    print("=" * 60)
    
    client = ApiClient(args.base_url)
    
    # Test connection
    try:
        health_check = client._request('GET', '/health')
        print(f"✓ Connected to API at {args.base_url}")
    except Exception as e:
        print(f"✗ Failed to connect to API: {e}")
        print("\nMake sure your Worker is running:")
        print("  npm run dev")
        sys.exit(1)
    
    stats = {
        'episodes': {'created': 0, 'updated': 0, 'skipped': 0},
        'research': {'created': 0, 'skipped': 0},
        'pairings': {'created': 0, 'skipped': 0},
    }
    
    # Import episodes
    if not args.skip_episodes:
        stats['episodes'] = import_episodes(client, args.data_dir, args.dry_run)
    
    # Import research
    if not args.skip_research:
        stats['research'] = import_research(client, args.data_dir, args.dry_run)
    
    # Import pairings
    if not args.skip_pairings:
        stats['pairings'] = import_pairings(client, args.data_dir, args.dry_run)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 Import Summary")
    print("=" * 60)
    
    if not args.skip_episodes:
        print(f"Episodes:")
        print(f"  Created: {stats['episodes']['created']}")
        print(f"  Updated: {stats['episodes']['updated']}")
        print(f"  Skipped: {stats['episodes']['skipped']}")
    
    if not args.skip_research:
        print(f"\nResearch Entries:")
        print(f"  Created: {stats['research']['created']}")
        print(f"  Skipped: {stats['research']['skipped']}")
    
    if not args.skip_pairings:
        print(f"\nPairings:")
        print(f"  Created: {stats['pairings']['created']}")
        print(f"  Skipped: {stats['pairings']['skipped']}")
    
    total_created = (
        stats['episodes']['created'] + stats['episodes']['updated'] +
        stats['research']['created'] + stats['pairings']['created']
    )
    
    print("\n" + "=" * 60)
    if args.dry_run:
        print(f"✓ Would import {total_created} items (DRY RUN)")
    else:
        print(f"✓ Import complete! {total_created} items imported")
    print("=" * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

