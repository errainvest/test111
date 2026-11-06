#!/bin/bash
# Align every floor of a building to its reference floor (the one shown inside: M2 floor ג׳ = M3; for E floor ב׳ = E2), then copy extras.
set -e
SP=/tmp/claude-0/-home-user-test111/8b79820d-fe27-50d8-a08a-07d66f26ce11/scratchpad
B=$SP/bldg; O=$B/out2; O3=$B/out3; mkdir -p $O3
AL="python3 -I $SP/tools2/align.py"
cp $O/E2.json $O3/E2.json; cp $O/M3.json $O3/M3.json; python3 -I $SP/tools2/fix_m3.py $O3/M3.json
[ -f $O/apt4_fixtures.json ] && cp $O/apt4_fixtures.json $O3/apt4_fixtures.json
E1SRC=$O/E1.json; [ -f $E1SRC ] || E1SRC=$B/out/E1.json
[ -f $E1SRC ] && $AL $E1SRC $O3/E2.json --kinds=core,mamad --apply=$O3/E1.json | tee $O3/E1.tf
[ -f $O/apt4_fixtures.json ] && cp $O/apt4_fixtures.json $O3/apt4_fixtures.json
[ -f $O/E3.json ] && $AL $O/E3.json $O3/E2.json --kinds=core,mamad --apply=$O3/E3.json
[ -f $O/ER.json ] && $AL $O/ER.json $O3/E3.json --kinds=low --kindsB=ext,core,mamad --apply=$O3/ER.json
[ -f $O/M2.json ] && $AL $O/M2.json $O3/M3.json --kinds=core,mamad --apply=$O3/M2.json
[ -f $O/M1.json ] && $AL $O/M1.json $O3/M3.json --kinds=core,mamad --init=0.03,-0.7 --apply=$O3/M1.json
[ -f $O/M4.json ] && $AL $O/M4.json $O3/M3.json --kinds=core,mamad --apply=$O3/M4.json
[ -f $O/MR.json ] && $AL $O/MR.json $O3/M4.json --kinds=low --kindsB=ext,core,mamad --apply=$O3/MR.json
if [ -f $O/SITE.json ]; then
  TFM=$( $AL $O/M1.json $O3/M3.json --kinds=core,mamad --init=0.03,-0.7 | grep -o 'theta=[-0-9.]* deg  t=([-0-9.]*,[-0-9.]*)' | sed 's/theta=//; s/ deg  t=(/,/; s/)//')
  if [ -f $O3/E1.tf ]; then TFE=$(grep -o 'theta=[-0-9.]* deg  t=([-0-9.]*,[-0-9.]*)' $O3/E1.tf | sed 's/theta=//; s/ deg  t=(/,/; s/)//'); else TFE="0.41,0.0855,-0.0644"; fi
  echo "site transforms M2 side: $TFM  E side: $TFE"
  python3 -I $SP/tools2/site_fix.py $O/SITE.json $O3/SITE.json "$TFM" "$TFE"
fi
