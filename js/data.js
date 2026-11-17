/* ───────────────────────────────────────────────
   CHAWAL scrapbook — everything you'd want to edit lives here.
   Swap the blurbs for real inside jokes, add tapes for new edits.
   ─────────────────────────────────────────────── */
window.CHAWAL = {
  /* paste the Google Apps Script web-app URL here (see backend/SETUP.md).
     while it's empty the guestbook + calendar run in demo mode: saved on this device only. */
  backend: 'https://script.google.com/macros/s/AKfycby4xdiVYsJrDbUXQw6sRTTOf--d3G9NTHYylDz-zyJIeWgT2BtfWHBZsYjGjBZnvueW8w/exec',
  /* the live link to this scrapbook, used in WhatsApp messages */
  siteUrl: 'https://chawal-wine.vercel.app',

  /* the heart. the rice. the reason. */
  heart: {
    id: 'muhsin',
    name: 'Muhsin',
    ingredient: 'the chawal itself',
    sticker: 'assets/people/muhsin-face.webp',
    line: 'no muhsin, no chawal. literally — he started this group, and everyone else just got cooked in.',
  },

  /* the other four ingredients (order = board position: left-top, left-bottom, right-top, right-bottom) */
  members: [
    {
      id: 'pavitra', name: 'Pavitra', ingredient: 'the ghee', face: 'assets/people/pavitra-face.webp',
      tape: 'pink', tilt: -4,
      blurb: 'makes everything richer. the curls, the smile, permanent main-character lighting.',
      likely: 'have the best hair in the photo (the curls carry the frame)',
      stats: { chaos: 72, snacks: 96, 'on time': 58 },
    },
    {
      id: 'hatim', name: 'Hatim', ingredient: 'the achaar', face: 'assets/people/hatim-face.webp',
      tape: 'yellow', tilt: 3,
      blurb: 'a little spicy, always on the side, and the plate feels empty the second he isn’t there.',
      likely: 'wear the #10 jersey like he’s about to take the penalty',
      stats: { chaos: 80, snacks: 74, 'on time': 66 },
    },
    {
      id: 'hamza', name: 'Hamza', ingredient: 'the dal', face: 'assets/people/hamza-face.webp',
      tape: 'blue', tilt: 4,
      blurb: 'steady, tall, goes with literally everything. chawal’s most obvious pairing.',
      likely: 'be the tallest person in every single group photo',
      stats: { chaos: 55, snacks: 70, 'on time': 82 },
    },
    {
      id: 'tanya', name: 'Tanya', ingredient: 'the papad', face: 'assets/people/tanya-face.webp',
      tape: 'green', tilt: -3,
      blurb: 'the crunch. glasses on, snacks in hand, the loudest thing on the plate in the best way.',
      likely: 'pull out a packet of chips in the middle of a selfie',
      stats: { chaos: 88, snacks: 81, 'on time': 47 },
    },
  ],

  /* the screening room — add a tape for every new edit (mp4 in assets/edits) */
  tapes: [
    { title: 'how i met chawal', sub: 'the opener · 0:12', src: 'assets/edits/how-i-met-chawal.mp4', poster: 'assets/edits/how-i-met-chawal.jpg', color: '#f2b632' },
    { title: 'memories', sub: 'chawal 25–26 · 0:51', src: 'assets/edits/memories.mp4', poster: 'assets/edits/memories.jpg', color: '#e2483d' },
    { title: 'your next edit', sub: 'drop it in assets/edits', src: null, color: '#9cbf6b' },
  ],

  /* every photo, for the messy desk + lightbox captions */
  photos: [
    { src: 'assets/photos/p01.webp', cap: 'santa hats: mandatory' },
    { src: 'assets/photos/p02.webp', cap: 'ironed kurtas, all 5 present' },
    { src: 'assets/photos/p03.webp', cap: 'dressed to impress' },
    { src: 'assets/photos/p04.webp', cap: 'vamos, chawal' },
    { src: 'assets/photos/p05.webp', cap: 'hq: dough & joe' },
    { src: 'assets/photos/p06.webp', cap: 'blazers + attitude' },
    { src: 'assets/photos/p07.webp', cap: 'we were on tv (sort of)' },
    { src: 'assets/photos/p08.webp', cap: 'fairy lights & bad jokes' },
    { src: 'assets/photos/p09.webp', cap: 'yeehaw' },
    { src: 'assets/photos/p10.webp', cap: 'xoxo, chawal' },
    { src: 'assets/photos/p11.webp', cap: 'talaash traditional day' },
    { src: 'assets/photos/p12.webp', cap: 'snack break' },
    { src: 'assets/photos/p13.webp', cap: 'too close to the camera' },
    { src: 'assets/photos/p14.webp', cap: 'night out, full squad' },
    { src: 'assets/photos/p15.webp', cap: 'all we need is dough & joe' },
  ],
};
