#!/usr/bin/env bash
set -euo pipefail
umask 077

database=${1:?Database name required}
directory=${2:?New absolute backup directory required}
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ "$database" =~ ^[a-zA-Z0-9_]+$ ]] || exit 2
[[ "$directory" == /var/tmp/transporte-release-* ]] || exit 2
[[ ! -e "$directory" ]] || { echo 'Backup directory already exists' >&2; exit 2; }
mkdir -m 700 -- "$directory"

# The caller owns the file; PostgreSQL access uses the VM's existing sudo policy.
sudo -n -u postgres pg_dump --format=custom --no-owner --no-acl --dbname="$database" > "$directory/database.dump"
pg_restore --list "$directory/database.dump" > "$directory/archive-list.txt"
sudo -n -u postgres psql -X -qAt -v ON_ERROR_STOP=1 --dbname="$database" < "$script_dir/database-inventory.sql" > "$directory/inventory.ndjson"
(
  cd -- "$directory"
  sha256sum database.dump archive-list.txt inventory.ndjson > SHA256SUMS
)
chmod 600 -- "$directory/"*
echo "Backup completed: $directory"
