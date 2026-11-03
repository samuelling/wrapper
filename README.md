# Shrink-Wrapped Menagerie

Living animals reconstructed the way dinosaurs often are: skin pulled straight over the skeleton. Slide each one from **skeleton** → **shrink-wrapped** → **alive**, for the whole body or just the skull.

Animals: house cat, African elephant, mute swan, American bison, barn owl, Nile crocodile.

![Shrink-wrapped and alive stages](docs/stages.png)

## Run it

Static files with no build step. Open `index.html`, or serve the folder (GitHub Pages works from the repo root).

## How it works

- `animals.js`: each animal is a simplified side-view skeleton (bones, teeth, holes, recesses) plus soft-tissue shapes, eyes and details, in a 1000 × 620 world frame. All animals face right, with the ground at y = 560.
- `engine.js`: rasterises the layers and builds three signed-distance and height fields:
  - **Bone**: the bones, rounded, with outlines and recesses.
  - **Shrink-wrap**: a morphological closing of the bones (so skin bridges gaps but sinks into hollows), plus a skin thickness. Near and far limbs are wrapped separately.
  - **Alive**: shrink-wrap united with the soft tissue, then smoothed, given fur or feather texture and coloured.
  
  The morph interpolates the fields, and every frame is relit with normals taken from the height field.
- `app.js`: UI, caching, playback and the scale bar.

Skeletons are diagrams, not traced specimens. The idea comes from *All Yesterdays* (2012) by Conway, Kosemen and Naish.
