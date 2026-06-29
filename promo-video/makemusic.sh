#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p audio
# Upbeat, warm "bakery / corporate" bed. 120 BPM, C-G-Am-F (I-V-vi-IV), major & bright.
# Each chord = 1 bar (2s). Pad + bouncy marimba arpeggio + shaker + backbeat clap.

PADA=0.12
# pad chord: sum of 3 mid sines, 2s, soft edges to avoid clicks
pad () { ffmpeg -y -loglevel error -f lavfi -i "aevalsrc=${1}:d=2:s=44100" \
  -af "afade=t=in:d=0.05,afade=t=out:st=1.95:d=0.05" "audio/$2"; }
pad "${PADA}*sin(2*PI*261.63*t)+${PADA}*sin(2*PI*329.63*t)+${PADA}*sin(2*PI*392.00*t)" p1.wav
pad "${PADA}*sin(2*PI*196.00*t)+${PADA}*sin(2*PI*246.94*t)+${PADA}*sin(2*PI*293.66*t)" p2.wav
pad "${PADA}*sin(2*PI*220.00*t)+${PADA}*sin(2*PI*261.63*t)+${PADA}*sin(2*PI*329.63*t)" p3.wav
pad "${PADA}*sin(2*PI*174.61*t)+${PADA}*sin(2*PI*220.00*t)+${PADA}*sin(2*PI*261.63*t)" p4.wav
ffmpeg -y -loglevel error -i audio/p1.wav -i audio/p2.wav -i audio/p3.wav -i audio/p4.wav \
  -filter_complex "[0][1][2][3]concat=n=4:v=0:a=1[a]" -map "[a]" audio/pad8.wav

# marimba arpeggio: 8th notes (0.25s), 4-note cycle per chord, plucky decay
arp () { # $1..$4 notes  $5 out
  ffmpeg -y -loglevel error -f lavfi -i \
   "aevalsrc='0.26*exp(-9*(t-0.25*floor(t/0.25)))*sin(2*PI*(${1}*eq(mod(floor(t/0.25)\,4)\,0)+${2}*eq(mod(floor(t/0.25)\,4)\,1)+${3}*eq(mod(floor(t/0.25)\,4)\,2)+${4}*eq(mod(floor(t/0.25)\,4)\,3))*t)':d=2:s=44100" "audio/$5"
}
arp 523.25 659.25 783.99 659.25 a1.wav
arp 392.00 493.88 587.33 493.88 a2.wav
arp 440.00 523.25 659.25 523.25 a3.wav
arp 349.23 440.00 523.25 440.00 a4.wav
ffmpeg -y -loglevel error -i audio/a1.wav -i audio/a2.wav -i audio/a3.wav -i audio/a4.wav \
  -filter_complex "[0][1][2][3]concat=n=4:v=0:a=1[a]" -map "[a]" audio/arp8.wav

# master: loop pad+arp to 32s, add shaker (8th-note noise) + backbeat clap, brighten, normalize
ffmpeg -y -loglevel error \
  -i audio/pad8.wav -i audio/arp8.wav \
  -f lavfi -i "anoisesrc=color=white:d=32:s=44100" \
  -f lavfi -i "aevalsrc='0.5*exp(-26*mod(t+0.5\,1))*(2*random(0)-1)':d=32:s=44100" \
  -filter_complex "\
   [0]aloop=loop=3:size=352800,volume=0.5[pad]; \
   [1]aloop=loop=3:size=352800,volume=0.6,aecho=0.8:0.6:40|75:0.15|0.1[arp]; \
   [2]highpass=f=7000,tremolo=f=4:d=0.85,volume=0.05[shk]; \
   [3]highpass=f=1400,lowpass=f=7000,volume=0.2[clp]; \
   [pad][arp][shk][clp]amix=inputs=4:duration=longest:normalize=0[mix]; \
   [mix]highpass=f=130,lowpass=f=9000,equalizer=f=1600:width_type=o:width=1.4:g=3,\
   afade=t=in:st=0:d=1,afade=t=out:st=28:d=2,\
   loudnorm=I=-13:TP=-1.5:LRA=10,atrim=0:30[out]" \
  -map "[out]" -ar 44100 -c:a aac -b:a 192k audio/music.m4a
echo "dur:"; ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 audio/music.m4a
ffmpeg -hide_banner -i audio/music.m4a -af volumedetect -f null /dev/null 2>&1 | grep -E "mean_volume|max_volume"
