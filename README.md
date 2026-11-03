# Wrapper: the Shrink-Wrap Gallery

A walkable 3D hall modelled on the Grande Galerie de l'Évolution in Paris. Six living animals march in a procession down the nave at real scale: an African elephant, an American bison, a Nile crocodile, a mute swan, a house cat and a barn owl. Each one can be slid from **skeleton** → **shrink-wrapped** → **alive**, the way dinosaurs are too often reconstructed. In 3D, the skin grows out of the bones and then fills out into muscle, fur and feathers.

![The gallery](docs/gallery.png)

## Visiting

Open `index.html` from a static server (for example `python3 -m http.server`) or GitHub Pages. There is no build step.

- **Look:** drag. **Walk:** W A S D or the arrow keys (Shift to hurry); on a phone, use the joystick.
- **Choose an animal:** look at it, tap it, or use ‹ › to glide to each one.
- **Balcony:** go up to the first gallery and look down on the procession.
- **All six:** move every animal through the stages together.

`plates/` holds the earlier flat side-view version.

![Shrink-wrapped and alive stages](docs/stages.png)

## How it's made

- `js/anatomy.js`: each animal as simplified anatomy. Bones, teeth, holes, recesses and soft tissue are authored in side-view coordinates with lateral depth: ribs hoop around the chest, skulls are inflated with widths that taper along the snout, and limbs and girdles sit on each side.
- `tools/export3d.js`: runs the anatomy through a 3D builder and writes primitives to `build/prims/`.
- `tools/bake.py`: voxelises each animal (numpy, scipy, scikit-image, fast-simplification) and builds three surfaces:
  - **bone**
  - **shrink-wrap**: a morphological closing of the bones, so skin can't squeeze between ribs but sinks into every hollow, plus a skin thickness, with teeth kept sharp
  - **alive**: wrap plus soft tissue, closed and smoothed, with fur displacement

  Every wrap vertex is projected onto the bones, and every living vertex onto the wrap. Those projections are the morph targets that let the skin grow in real time. Output goes to `data/<id>.json`, with mesh arrays packed as base64.
- `js/specimen.js`: loads a baked animal into three morphing meshes, with coat colours computed from the anatomy file.
- `js/hall.js` and `js/main.js`: the hall (glass roof, cast-iron columns, two balcony tiers, procession platform), navigation and the UI.

To rebuild the meshes:

```
node tools/export3d.js
python3 tools/bake.py            # or: python3 tools/bake.py cat owl
```

The skeletons are diagrams, not traced specimens. The idea comes from *All Yesterdays* (2012) by John Conway, C. M. Kosemen and Darren Naish.
