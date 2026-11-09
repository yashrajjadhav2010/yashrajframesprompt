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
    category: "Royal",
    description: "Opulent regal lighting, deep midnight velvet tones, and antique gold embroidery enhancement.",
    thumbnail: "assets/prompts/royal-portrait.jpg",
    referenceImage: "assets/prompts/royal-portrait.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Cinematic regal portrait grading, dark midnight sapphire velvet tones (#0A1128), warm directional amber rim lighting at 3200K, subtle rim light catchlights in eyes, preserve authentic facial micro-textures and natural skin pores, enhance micro-contrast on antique bullion embroidery and jewelry without over-sharpening, smooth 35mm film grain gradation, Hasselblad H6D-100c medium format portrait aesthetic, neutral tonal roll-off in highlights, deep obsidian shadows.`,
    featured: true,
    tags: ["Royal", "Portrait", "Cinematic", "Heritage", "Studio"]
  },
  {
    id: 2,
    title: "Grand Palace Mandap Ceremony",
    category: "Wedding",
    description: "Twilight courtyard warmth, floating floral petals, and heirloom gold jewelry brilliance.",
    thumbnail: "assets/prompts/wedding-grandeur.jpg",
    referenceImage: "assets/prompts/wedding-grandeur.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Editorial Indian wedding photography grading, heritage courtyard twilight ambiance with warm tungsten fairy illumination, preserve rich true-to-life crimson red (#9B111E) and vermilion textile dyes, soft optical flare around ceremonial sacred fire, crisp separation of bride and groom from background architectural pillars, subtle atmospheric haze, natural creamy skin undertones, highlight retention on polished 22k gold jewelry, 85mm f/1.4 cinematic depth of field.`,
    featured: true,
    tags: ["Wedding", "Royal", "Ceremony", "Traditional", "Evening"]
  },
  {
    id: 3,
    title: "Archival Sepia Fine Art Restoration",
    category: "Restoration",
    description: "Museum-grade heritage photo reconstruction, scratch and crease removal with balanced tonal fidelity.",
    thumbnail: "assets/prompts/vintage-restoration.jpg",
    referenceImage: "assets/prompts/vintage-restoration.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Archival photograph conservation and restoration, complete reconstruction of silver gelatin print degradation, seamless repair of surface emulsion cracks, fold lines, and silvering damage. Rebalance historic dynamic range while retaining authentic fiber-based photographic paper texture, natural sepia tone curve (#3D2B1F to #F4EBD9), reconstruct facial features strictly aligned to vintage bone structure without artificial plastic smoothing, museum exhibition clarity.`,
    featured: true,
    tags: ["Restoration", "Archival", "Sepia", "Vintage", "Fine Art"]
  },
  {
    id: 4,
    title: "Editorial Sculpted Monochrome",
    category: "Portrait",
    description: "Dramatic chiaroscuro studio lighting, intense tonal depth, and tactile textile definition.",
    thumbnail: "assets/prompts/editorial-monochrome.jpg",
    referenceImage: "assets/prompts/editorial-monochrome.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
High-contrast black-and-white editorial portrait, dramatic split Rembrandt studio lighting with deep obsidian shadow drop-off, silver bromide monochrome paper tonal curve, razor-sharp focus on iris reflections and bone contours, tactile fabric micro-texture retention on dark wool and cashmere, gentle highlight rolloff, zero color tint, pure neutral grey scale grading, Leica M Monochrome 50mm Summilux aesthetic.`,
    featured: true,
    tags: ["Portrait", "Cinematic", "Monochrome", "Editorial", "Studio"]
  },
  {
    id: 5,
    title: "Luminous Deepavali Festive Diya",
    category: "Festival",
    description: "Warm golden flame reflections, shimmering silk highlights, and festive bokeh ambiance.",
    thumbnail: "assets/prompts/festival-glow.jpg",
    referenceImage: "assets/prompts/festival-glow.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Festive night portrait, warm organic candlelight from brass diya lamp radiating glowing illumination onto hands and face, deep royal cobalt blue silk sari with golden zari highlights, smooth circular bokeh background from festive strings of fairy lights, gentle warm skin glow without oversaturating yellows, preserve authentic mehendi detail and floral jasmine texture, 50mm f/1.2 cinematic festive grading.`,
    featured: true,
    tags: ["Festival", "Traditional", "Portrait", "Warm Light", "Celebration"]
  },
  {
    id: 6,
    title: "Ethereal Newborn Milestone Art",
    category: "Baby Photography",
    description: "Gentle northern window diffusion, organic wool textures, and soft pastel neutral palette.",
    thumbnail: "assets/prompts/baby-milestone.jpg",
    referenceImage: "assets/prompts/baby-milestone.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Fine-art newborn baby milestone photography, ultra-soft diffused northern daylight from 45-degree angle, high-key organic oatmeal and cream textured wool wrap, delicate eucalyptus and dried bunny-tail floral accents, pristine baby skin tones with soft highlight diffusion and gentle pink undertones, creamy smooth background transition, zero harsh shadows, peaceful timeless fine-art studio finish.`,
    featured: true,
    tags: ["Baby Photography", "Milestone", "Studio", "Ethereal", "Minimalist"]
  },
  {
    id: 7,
    title: "Golden Hour Cinematic Couple",
    category: "Couple",
    description: "Warm sunset rim lighting, romantic silhouette gradients, and gentle wind-blown motion blur.",
    thumbnail: "assets/prompts/couple-sunset.jpg",
    referenceImage: "assets/prompts/couple-sunset.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Cinematic outdoor couple portraiture at sunset golden hour (2800K), backlit golden rim light outlining hair and silhouettes, warm amber color cast with soft cyan complementary shadow tones, organic lens flare with subtle anamorphic horizontal streak, emotional intimate composition, preserve authentic facial expressions and natural textile movement, Kodak Portra 400 color science.`,
    featured: true,
    tags: ["Couple", "Cinematic", "Golden Hour", "Outdoor", "Romantic"]
  },
  {
    id: 8,
    title: "Traditional Heritage Sangeet Glow",
    category: "Traditional",
    description: "Vibrant ethnic hues, celebratory motion energy, and gilded architectural framing.",
    thumbnail: "assets/prompts/festival-glow.jpg",
    referenceImage: "assets/prompts/festival-glow.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Traditional Indian celebration color grading, vibrant magenta, marigold orange, and emerald green textile separation, dynamic lighting balance accommodating theatrical stage LEDs and warm ambient lamps, frozen motion sharpness with subtle energetic light trail highlights, crisp embroidery accents, rich melanin skin tone fidelity, high-energy festival atmosphere.`,
    featured: false,
    tags: ["Traditional", "Festival", "Ceremony", "Culture"]
  },
  {
    id: 9,
    title: "Studio Biometric Passport Precision",
    category: "Passport",
    description: "ICAO standard compliant illumination, neutral grey background, and shadowless facial clarity.",
    thumbnail: "assets/prompts/editorial-monochrome.jpg",
    referenceImage: "assets/prompts/editorial-monochrome.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Official studio biometric passport identification specification, perfectly balanced flat butterfly lighting, calibrated 18% neutral studio grey background (#B0B0B0), zero cast shadows under chin or ears, true 1:1 color accuracy, natural skin tone representation with no skin smoothing or artificial modifications, crisp focus across eyes, nose and ears, compliant with international visa standards.`,
    featured: false,
    tags: ["Passport", "Studio", "Official", "Clean"]
  },
  {
    id: 10,
    title: "Maharani Royal Court Portraiture",
    category: "Royal",
    description: "Timeless princely aesthetic, emerald kundan jewels, and rich crimson velvet framing.",
    thumbnail: "assets/prompts/royal-queen.jpg",
    referenceImage: "assets/prompts/royal-queen.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Classical 19th century royal court fine-art look, rich deep mahogany wood and crimson velvet tones, soft painterly highlight bloom on kundan emerald jewelry and gold zardozi border, deep textured canvas brushwork underlayer, dignified composed posture grading, warm museum gallery light temperature.`,
    featured: true,
    tags: ["Royal", "Traditional", "Heritage", "Artistic"]
  },
  {
    id: 11,
    title: "First Birthday Joyful Milestone",
    category: "Birthday",
    description: "Playful pastel party aesthetics, bright airy mood, and celebratory cake smash framing.",
    thumbnail: "assets/prompts/baby-milestone.jpg",
    referenceImage: "assets/prompts/baby-milestone.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Joyful children's first birthday celebration, clean bright pastel balloon garland backdrop (sage green, cream, soft gold), crisp capture of toddler laughter, high dynamic range preserving delicate white cake frosting and pastel party hats, clean soft shadows, vibrant joyful color rendition.`,
    featured: false,
    tags: ["Birthday", "Baby Photography", "Celebration", "Studio"]
  },
  {
    id: 12,
    title: "Fine Art Matched Framing Tone",
    category: "Other",
    description: "Museum matting color balance, archival gallery preview, and border calibration for large prints.",
    thumbnail: "assets/prompts/vintage-restoration.jpg",
    referenceImage: "assets/prompts/vintage-restoration.jpg",
    prompt: `[SAMPLE EDITING PROMPT PLACEHOLDER - FOR DEMO PURPOSES]:
Large format fine art photo print preparation, calibrated for Hahnemühle Photo Rag 308gsm matte paper, expanded shadow tonal separation for pigment ink print longevity, custom archival off-white 2-inch border simulation, chromatic aberration correction, balanced contrast intended for gallery glass display under 5000K museum spotlights.`,
    featured: false,
    tags: ["Other", "Restoration", "Fine Art", "Printing", "Frames"]
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
  "Other"
];

// Export for module systems or attach to window for static vanilla script tag
if (typeof module !== "undefined" && module.exports) {
  module.exports = { prompts, CATEGORIES };
}
