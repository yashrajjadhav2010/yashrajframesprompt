/**
 * YASHRAJ FRAMES – AI STUDIO
 * Prompt Data Library
 * 
 * Note: Sample prompt texts below are clearly marked sample placeholders
 * for demonstration purposes within this workspace. Replace or expand with
 * your photography studio's proprietary production prompts.
 */

const prompts = [
  {
    id: 1,
    title: "Royal Cinematic Heritage Portrait",
    category: "Cinematic",
    description: "Opulent regal lighting, deep midnight velvet tones, and antique gold embroidery enhancement.",
    thumbnail: "assets/prompts/01.jpeg",
    referenceImage: "assets/prompts/01.jpeg",
    prompt: `A cinematic, high-energy movie-poster style portrait featuring the exact person from the reference image, maintaining their facial features, structure, and identity unchanged. The composition includes a large, double-exposure effect with a moody, dark background dominated by striking crimson-red and charcoal-black tones. In the background, a massive, distressed 3D typographic text reads "[YOUR NAME]" in gritty, textured red letters. Below it, a sleek handwritten cursive signature overlay reads "[YOUR LAST NAME]". In the foreground, the full-body character stands under a dramatic overhead spotlight on a wet, reflective industrial concrete floor. The lighting features harsh backlighting and glowing red neon geometric light frames. Gritty textures, flying dust particles, cinematic atmosphere, motivational text elements like 'FOCUS. DISCIPLINE. CONSISTENCY.' and 'Stay Low. Build High.' subtly placed in the corners, 8k resolution, masterpiece.`,
    featured: true,
    tags: [ "Portrait", "Cinematic", "Heritage", "Studio"]
  },
  {
    id: 2,
    title: "Cinematic Posing boy",
    category: "Cinematic",
    description: "Twilight courtyard warmth, floating floral petals, and heirloom gold jewelry brilliance.",
    thumbnail: "assets/prompts/02.jpeg",
    referenceImage: "assets/prompts/02.jpeg",
    prompt: `​A high-end, editorial fashion collage poster design. The design features four precisely stacked, horizontal panels with rounded corners in the background. Each panel contains a different, monochromatic black and white cinematic portrait of the man in various stylish fashion poses (e.g., looking up with sunglasses, looking down, and a close-up without sunglasses). All B&W portraits must preserve the unique facial identity, facial structure, and expression of the subject for seamless consistency. In the foreground, a detailed full-color cutout of the same man stands confidently, wearing a deep red, untucked oversized button-down shirt, black pants, black sunglasses, and black loafers. His pose is confident, standing, with hands relaxed, exactly as in the reference pose. The color palette is restricted to monochrome background and sharp red/black foreground. Clean composition, precise masking, high resolution, minimalist presentation`,
    featured: true,
    tags: ["Wedding", "Royal", "Ceremony", "Traditional", "Evening"]
  },
  {
    id: 3,
    title: "Birthday poses!!",
    category: "Birthday",
    description: "Museum-grade heritage photo reconstruction, scratch and crease removal with balanced tonal fidelity.",
    thumbnail: "assets/prompts/03.jpeg",
    referenceImage: "assets/prompts/03.jpeg",
    prompt: `A modern, celebratory birthday-themed editorial poster design on a solid black background. CRITICAL REQUIREMENT: The face, facial features, bone structure, hairstyle, and identity of the subject must be identical to the provided reference photo—do not alter, morph, or replace the face with a generic AI face. In the top-left section, bold, clean 3D white typography reads "HAPPY BIRTHDAY!" with a gift icon and a cursive subtitle reading "Wishing you a cinematic year!". The right and lower background features a vertical stack of four rounded rectangular panels containing black and white cinematic portraits of the exact same man. In the foreground, a full-color cutout of the same man with a white outline border, wearing a dusty pink unbuttoned shirt over a white t-shirt and dark sunglasses, striking a confident pose. High-contrast lighting, sharp composition, perfect face consistency.`,
    featured: true,
    tags: ["Birthday", "Cinematic", "Sepia", "Vintage", "Fine Art"]
  },
  {
    id: 4,
    title: "cinematic girl portrait",
    category: "Portrait",
    description: "Dramatic chiaroscuro studio lighting, intense tonal depth, and tactile textile definition.",
    thumbnail: "assets/prompts/04.jpeg",
    referenceImage: "assets/prompts/04.jpeg",
    prompt: `A modern, aesthetic multi-panel editorial collage poster design on a clean off-white background with teal and turquoise brushstroke accents and tiny floral illustrations. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, hair texture, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. The design features an artistic mosaic of multiple split and full panels containing a mix of vibrant full-color portraits and cinematic black-and-white close-ups of the exact same subject in various outfits and expressions. Large, elegant cursive typography in the top-left reads "Her" with a small heart icon, accompanied by subtitle text "SAME GIRL. DIFFERENT SHADES.". Other panels include minimal text elements like "CUTE, CHAOTIC, REAL, KIND, TALENTED, UNFILTERED, HER." and "Just a girl who feels everything.". High-resolution editorial styling, clean grid composition, absolute face consistency.`,
    featured: true,
    tags: ["Portrait", "Cinematic", "Monochrome", "Editorial", "Studio"]
  },
  {
    id: 5,
    title: "Bride Cinematic Memory rounded",
    category: "Wedding",
    description: "Warm golden flame Bride reflections, shimmering silk highlights, and festive bokeh ambiance.",
    thumbnail: "assets/prompts/05.jpeg",
    referenceImage: "assets/prompts/05.jpeg",
    prompt: `A grand, elegant wedding editorial album poster design featuring a bright ivory background with soft, glowing gold floral elements, glowing feathers, and artistic botanical overlays. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. The central focus is a full-body portrait of the subject in the foreground, wearing a heavy traditional red and embroidered bridal lehenga, matching chura, traditional jewelry, and a veil. Surrounding the central figure is an artistic collage layout consisting of multiple rectangular and square photo frames (some in vibrant full-color wedding lighting and others in cinematic black and white) showcasing different candid moments and close-up portraits of the exact same subject. In the bottom right section, elegant cursive typography reads "Enjoy The Bride Moment". High-end wedding photography styling, clean framing, absolute face consistency.`,
    featured: true,
    tags: ["Wedding", "Traditional", "Portrait", "Warm Light", "Celebration"]
  },
  {
    id: 6,
    title: "Bride Cinematic side portrait",
    category: "Wedding",
    description: "Gentle northern window diffusion, organic wool textures, and soft pastel neutral palette.",
    thumbnail: "assets/prompts/06.jpeg",
    referenceImage: "assets/prompts/06.jpeg",
    prompt: `A modern, elegant wedding photo editing layout on a clean white background. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. On the left foreground, a full-body cutout of the subject stands wearing a heavy traditional red and gold embroidered bridal lehenga with traditional jewelry and a veil. In the upper right background, a vertical column of four slanted, rounded rectangular panels features different close-up portraits and candid shots of the exact same subject in bridal attire. In the bottom right section, elegant cursive typography displays the name "[YOUR NAME]" with a small subtitle text reading "Choundeshwari Digital" underneath. High-end professional bridal album design, sharp focus, absolute face consistency.`,
    featured: true,
    tags: ["Wedding", "Traditional", "Portrait", "Warm Light", "Celebration"]
  },
  {
    id: 7,
    title: "Golden Hour Cinematic Couple",
    category: "Couple",
    description: "Warm sunset rim lighting, romantic silhouette gradients, and gentle wind-blown motion blur.",
    thumbnail: "assets/prompts/13.jpg",
    referenceImage: "assets/prompts/13.jpg",
    prompt: `A romantic, high-end editorial couple photo collage poster on a clean white background with subtle torn-paper edge overlays. ABSOLUTE REQUIREMENT: The faces, exact facial features, bone structures, eyes, smiles, hairstyles, and identities of both individuals from the provided reference photos must strictly match without any alterations, morphing, or generic AI face changes. The background consists of a grid layout of multiple candid, cinematic monochrome (black-and-white) portraits showcasing romantic, affectionate moments of the couple. In the center foreground, a full-color torn-edge cutout of the same couple embracing warmly—the woman in an elegant traditional saree and the man in a light-colored ethnic kurta. In the lower-center section, stylish handwritten cursive typography reads "[NAME 1] ❤ [NAME 2]" with a red heart icon between them, followed by a custom date "[DATE]" in a clean sans-serif font below. High-contrast editorial photography, warm romantic lighting, absolute face consistency for both subjects.`,
    featured: true,
    tags: ["Couple", "Cinematic", "Golden Hour", "Outdoor", "Romantic"]
  },
  {
    id: 8,
    title: "cute kid birthday gift",
    category: "Birthday",
    description: "Birthday kid gift, celebratory motion energy, and gilded architectural framing.",
    thumbnail: "assets/prompts/07.jpeg",
    referenceImage: "assets/prompts/07.jpeg",
    prompt: `A professional studio birthday portrait design on a moody, dark grey textured background. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, expression, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. The subject is sitting gracefully on a vintage cream-colored retro scooter with gold accents and spoked wheels. Elegant typographic elements on the right side include the text ". H A P P Y ." in small letters, "Birthday" in a large pink cursive font, followed by "TO OUR LITTLE PRINCESS" and a large "4TH BIRTHDAY" graphic with a small heart icon. Professional studio lighting, cinematic shadows, glossy floor reflection, absolute face consistency.`,
    featured: false,
    tags: ["Birthday", "Festival", "Ceremony", "Culture"]
  },
  {
    id: 9,
    title: "Cute boy Standing Pose",
    category: "Cinematic",
    description: "Cute boy Standing Pose, neutral grey background, and shadowless facial clarity.",
    thumbnail: "assets/prompts/08.jpeg",
    referenceImage: "assets/prompts/08.jpeg",
    prompt: `A creative and stylish studio portrait setup featuring a warm, rustic indoor background with moody lighting and hanging vintage Edison light bulbs. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, hair, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. In the foreground, a full-body portrait of the subject stands confidently, leaning slightly against a wooden shelving unit, wearing a beige graphic t-shirt, light blue cargo pants, and white sneakers. To the left, a tall wooden shelving unit with separate stacked cubbies features individual smaller versions of the exact same subject posing differently in each box (reading a book, holding a toy, resting their head, etc.). Beside each cubby, large vertical marquee letters with warm glowing light bulbs spell out the name "YOUR NAME". Cinematic lighting, rich wooden textures, professional depth of field, absolute face consistency.`,
    featured: false,
    tags: ["Cinematic", "Studio", "Official", "Clean"]
  },
  {
    id: 10,
    title: "Boy cinematic Portraiture",
    category: "Cinematic",
    description: "Timeless princely aesthetic, emerald kundan jewels, and rich crimson velvet framing.",
    thumbnail: "assets/prompts/09.jpeg",
    referenceImage: "assets/prompts/09.jpeg",
    prompt: `A high-end, artistic studio portrait poster design with a warm, textured beige and brown grunge background featuring dramatic ink splatters and splashes. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, hair texture, and identity of the subject must strictly match the provided reference photo without any changes, alterations, or generic AI replacement. On the right side, a full-body cutout of the subject stands leaning against a clean white block, wearing a black shirt, white ethnic dhoti with gold trim, dark sunglasses, a watch, and stylish black-and-white sneakers. On the left side, a large, dramatic close-up portrait of the exact same subject is blended seamlessly into the background with a soft double-exposure effect. In the lower-left section, elegant cursive typography displays the name "[YOUR NAME]" topped with a small graphic crown and a subtitle below reading "— LITTLE PRINCE —" with royal decorative flourishes. Professional studio lighting, cinematic contrast, absolute face consistency.`,
    featured: true,
    tags: ["Cinematic", "Traditional", "Heritage", "Artistic"]
  },
  {
    id: 11,
    title: "First Birthday Joyful Milestone",
    category: "Birthday",
    description: "Playful pastel party aesthetics, bright airy mood, and celebratory cake smash framing.",
    thumbnail: "assets/prompts/12.jpeg",
    referenceImage: "assets/prompts/12.jpeg",
    prompt: `A professional birthday poster design on a clean, soft cream-colored background accented with pastel blue tones, floating balloons, stars, hearts, and cute teddy bears at the bottom. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, hair, and identity of the subject from the provided reference photo must be strictly preserved without any alterations or generic AI face changes. On the left side, a large number "1" shaped photo frame holds a vertical mosaic of smaller panels showing different candid portraits of the exact same subject. In the upper right section, a large monochrome (black-and-white) portrait of the subject is artistically blended into the background. In the foreground, a full-color portrait of the subject sitting down. In the middle right, elegant typography reads "HAPPY Birthday" followed by the name "[YOUR NAME]" in large blue script with a small crown icon, and subtitle text reading "Our Little Prince" and "365 DAYS OF LOVE, LAUGHTER & PURE JOY". High-resolution studio lighting, clean graphic layout, absolute face consistency.`,
    featured: false,
    tags: ["Birthday", "Baby Photography", "Celebration", "Studio"]
  },
  {
  id: 12,
  title: "Queen of Beauty Editorial Collage",
  category: "Editorial Portrait",
  description: "Aesthetic circular mosaic framing, elegant emerald green gown styling, and romantic typographic accents.",
  thumbnail: "assets/prompts/14.jpg",
  referenceImage: "assets/prompts/14.jpeg",
  prompt: `A high-end, romantic editorial collage poster design on a clean off-white background adorned with floating pink butterflies, red hearts, and a daisy flower accent. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, hair, and identity of the subject from the provided reference photo must be strictly preserved without any alterations or generic AI face changes. The background features a large curved arc arrangement containing multiple stacked black-and-white portraits showcasing different expressive close-ups of the exact same subject. In the foreground, a vibrant full-color cutout of the same subject wearing an elegant long dark-green heavily embroidered gown. In the central circle and surrounding areas, stylish script typography reads "Queen of Beauty" and "I Love you", with the name "Divya" in a large cursive font at the bottom alongside the phrase "Capture the moment" and a heartbeat line icon. High-end fashion editorial photography, soft lighting, absolute face consistency.`,
  featured: false,
  tags: ["Editorial", "Fashion", "Portrait", "Collage"]
},
{
  id: 13,
  title: "Cinematic Heritage Birthday Poster",
  category: "Birthday",
  description: "Dramatic triple-panel vertical split layout, moody crimson historic monument background, and elegant handwritten birthday typography.",
  thumbnail: "assets/prompts/15.jpg",
  referenceImage: "assets/prompts/15.jpeg",
  prompt: `A cinematic vertical triple-panel poster design[cite: 15]. ABSOLUTE REQUIREMENT: The face, exact facial features, bone structure, eyes, nose, smile, hair, and identity of the subject from the provided reference photo must be strictly preserved without any alterations or generic AI face changes[cite: 15]. The left and right side panels feature large, high-contrast monochrome (black-and-white) close-up side profiles of the exact same subject smiling[cite: 15]. The center panel features a deep crimson-red and dark moody background displaying an ancient historic stone pavilion and steps at twilight[cite: 15]. In the center foreground, a full-length portrait of the subject wearing an elegant light-colored traditional lehenga with sheer dupatta and earrings[cite: 15]. At the top of the central panel, elegant golden cursive typography reads "Happy Birthday"[cite: 15]. Hyperrealistic photography, dramatic lighting, absolute face consistency[cite: 15].`,
  featured: false,
  tags: ["Birthday", "Cinematic", "Portrait", "Editorial"]
}
];

// Helper to get all categories
const CATEGORIES = [
  "All",
  "Wedding",
  "Portrait",
  "Couple",
  "Birthday",
  "Baby Photography",
  "Traditional",
  "Royal",
  "Cinematic",
  "Restoration",
  "Passport",
  "Festival",
  "Editorial Portrait",
  "Other"
];

// Export for module systems or attach to window for static vanilla script tag
if (typeof window !== "undefined") {
  window.prompts = prompts;
  window.CATEGORIES = CATEGORIES;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { prompts, CATEGORIES };
}
