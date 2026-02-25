# Prompting Best Practices

## Structure

Good prompts follow this structure:

```
[Subject] + [Environment/Background] + [Style/Medium] + [Lighting/Mood] + [Composition] + [Constraints]
```

## Examples

### Product Photography
```
White ceramic coffee mug on rustic wooden table, soft studio lighting from left, shallow depth of field, minimalist style, clean background
```

### Illustration
```
Cute fox character, watercolor style, forest background, golden hour lighting, whimsical mood, centered composition
```

### 3D Render
```
Isometric 3D render of a cozy cabin, snowy mountains in background, low-poly style, soft shadows, warm interior glow
```

## Style Keywords

| Style | Keywords |
|-------|----------|
| Photorealistic | natural light, realistic texture, 8k, detailed |
| Minimalist | clean, simple, white space, flat |
| 3D | 3d render, cgi, blender, octane |
| Illustration | hand-drawn, vector, flat colors |
| Vintage | retro, 1970s, film grain, warm tones |
| Cinematic | dramatic lighting, movie still, anamorphic |

## Composition

| Term | Meaning |
|------|---------|
| close-up | Tight framing on subject |
| wide shot | Full environment visible |
| eye level | Camera at subject height |
| bird's eye | Top-down view |
| centered | Subject in middle |
| rule of thirds | Subject at intersection points |

## Lighting

| Term | Effect |
|------|--------|
| golden hour | Warm sunset light |
| soft light | Diffused, gentle shadows |
| dramatic shadows | High contrast |
| rim light | Subject outline highlight |
| backlit | Light from behind |

## Common Mistakes

❌ "Make a nice image of a cat"
✅ "Orange tabby cat, close-up, soft natural window light, cream-colored background, photorealistic"

❌ "Logo for tech company"
✅ "Minimal tech logo, geometric mountain shape, blue gradient, white background, vector style"

❌ "Picture of food"
✅ "Fresh salad bowl, top-down view, natural daylight from window, rustic wooden table, vibrant colors"

## Constraints

Add constraints to avoid unwanted elements:

```
Constraints:
- No text
- No logos
- No watermarks
- No people
- Keep product unchanged (for edits)
```

## For Edits

Always specify what should stay the same:

```
Prompt: Add autumn foliage to background
Constraints: Keep the subject's pose and clothing unchanged; preserve the existing lighting direction
```

## Testing Tips

1. Start simple, then add details
2. Test with `--count 1` first
3. Use `--seed` for reproducibility when iterating
4. Add one change at a time
5. Save good prompts for reuse
