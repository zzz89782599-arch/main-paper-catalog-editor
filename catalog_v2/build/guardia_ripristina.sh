#!/usr/bin/env bash
# guardia_ripristina.sh — rimette a posto SOLO i file toccati oltre il livello.
#
# Isaac, 26/08: «只回滚越界的那几个文件». Non si annulla tutto il commit: dentro c'e'
# anche il lavoro che quella persona POTEVA fare (le sue idee, le sue firme), ed e'
# proprio quello che non va perso. Si ripristina file per file e si scrive nel
# messaggio che cosa e' stato rimesso indietro e perche'.
#
# Uso:  build/guardia_ripristina.sh <sha_base> <sha_nuovo>
# Esce 0 se non c'era niente da fare, 1 se ha ripristinato (cosi' l'Action si vede).
set -euo pipefail

BASE="${1:?serve lo sha di partenza}"
NUOVO="${2:?serve lo sha nuovo}"
QUI="$(cd "$(dirname "$0")" && pwd)"

GIUDIZIO="$(node "$QUI/guardia_ruoli.js" "$BASE" "$NUOVO" || true)"
VERDETTO="$(printf '%s' "$GIUDIZIO" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).verdetto)}catch(e){console.log("ignoto")}})')"

if [ "$VERDETTO" != "oltre" ]; then
  echo "[guardia] niente da ripristinare (verdetto: $VERDETTO)"
  echo "$GIUDIZIO"
  exit 0
fi

CHI="$(printf '%s' "$GIUDIZIO" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s).chi)})')"
PERCHE="$(printf '%s' "$GIUDIZIO" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s).perche)})')"
FUORI="$(printf '%s' "$GIUDIZIO" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{JSON.parse(s).fuori.forEach(f=>console.log(f))})')"

echo "[guardia] oltre il livello: $CHI — $PERCHE"
printf '%s\n' "$FUORI" | sed 's/^/  · /'

# file per file: com'era PRIMA. Se prima non c'era, si toglie.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if git cat-file -e "$BASE:$f" 2>/dev/null; then
    git checkout "$BASE" -- "$f"
  else
    git rm -q --cached "$f" && rm -f "$f"
  fi
done <<< "$FUORI"

# ⚠️ l'identita' se la mette la guardia: dentro l'Action (e in una prova a
# freddo) git non ne ha una, e `git commit` fallisce con 128 — un rimedio che
# non riesce a scrivere il rimedio.
git -c user.name="guardia" -c user.email="guardia@mp-italia.invalid" \
  commit -q -m "guardia: rimessi a posto $(printf '%s\n' "$FUORI" | grep -c . ) file toccati oltre il livello

$CHI e' $PERCHE.
Il resto del commit $NUOVO resta com'e': le idee e le firme di chi ha
sbagliato file non si buttano via — sono proprio la parte che serve a
capire cos'e' successo.

File rimessi come stavano in $BASE:
$(printf '%s\n' "$FUORI" | sed 's/^/  · /')"
echo "[guardia] ripristinati. Ora c'e' un commit in piu' che lo dice."
exit 1
