"""Bake bone, shrink-wrap and living meshes for each animal from build/prims/<id>.json.

Fields are computed on a voxel grid:
  bone      occupancy of every bone primitive (recesses carved, holes cut)
  wrap      morphological closing of the bones (a ball of radius `wrap` cannot squeeze between them),
            plus a skin thickness; teeth stay sharp
  alive     wrap united with soft tissue, closed again with `blend`, smoothed, fur displaced
Morph targets: every wrap vertex is projected onto the bone surface, every living vertex onto the wrap,
so the skin can grow out of the bones in real time.
"""
import json, sys, math, struct, time
import numpy as np
from scipy import ndimage as ndi
from skimage.measure import marching_cubes
from matplotlib.path import Path
import fast_simplification as fsimp

import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
TARGET = {'bone': 34000, 'wrap': 22000, 'curator': 26000, 'alive': 28000}


def pw(pairs, x):
    xs = np.array([p[0] for p in pairs], dtype=np.float64)
    vs = np.array([p[1] for p in pairs], dtype=np.float64)
    return np.interp(x, xs, vs)


def hexcol(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


class Grid:
    def __init__(self, lo, hi, v):
        self.v = v
        self.lo = np.array(lo, dtype=np.float64)
        self.shape = tuple(int(math.ceil((hi[i] - lo[i]) / v)) + 1 for i in range(3))
        self.X = self.lo[0] + np.arange(self.shape[0]) * v
        self.Y = self.lo[1] + np.arange(self.shape[1]) * v
        self.Z = self.lo[2] + np.arange(self.shape[2]) * v

    def sl(self, a, lo, hi):
        i0 = max(0, int(math.floor((lo - self.lo[a]) / self.v)))
        i1 = min(self.shape[a], int(math.ceil((hi - self.lo[a]) / self.v)) + 1)
        return slice(i0, max(i0, i1))


def prim_extent(p):
    """xy box and |z| reach of a primitive (for the grid bounds)."""
    if p['kind'] == 'tube':
        P = np.array(p['pts']); r = np.array(p['r']); z = np.array(p['zsamp'])
        return P[:, 0].min() - r.max(), P[:, 0].max() + r.max(), P[:, 1].min() - r.max(), P[:, 1].max() + r.max(), (np.abs(z) + r).max()
    if p['kind'] == 'ell':
        R = max(p['rx'], p['ry'])
        return p['c'][0] - R, p['c'][0] + R, p['c'][1] - R, p['c'][1] + R, abs(p['zc']) + p['rz']
    P = np.array(p['pts'])
    th = p['th'] if p['th'] is not None else 0.5 * min(np.ptp(P[:, 0]), np.ptp(P[:, 1]))
    if p.get('thx'): th = max(t for _, t in p['thx'])
    zr = abs(p['z'])
    if p.get('zx'): zr = max(abs(t) for _, t in p['zx'])
    return P[:, 0].min(), P[:, 0].max(), P[:, 1].min(), P[:, 1].max(), zr + th


def localx(p, X, Y):
    f = p['frame']
    return ((X - f['ox']) * f['dx'] + (Y - f['oy']) * f['dy']) / f['sc']


def raster_tube(g, p, sign=1.0):
    """Union of tapered capsules between resampled centreline points."""
    P = np.array(p['pts']); R = np.array(p['r']); Zs = np.array(p['zsamp']) * sign
    # resample to roughly one voxel spacing
    keep = [0]
    acc = 0.0
    for i in range(1, len(P)):
        acc += math.hypot(P[i, 0] - P[i - 1, 0], P[i, 1] - P[i - 1, 1]) + abs(Zs[i] - Zs[i - 1])
        if acc >= max(g.v * 0.9, 0.35 * R[i]) or i == len(P) - 1:
            keep.append(i); acc = 0.0
    P, R, Zs = P[keep], R[keep], Zs[keep]
    R = np.maximum(R, 0.55 * g.v)
    out = []
    if len(P) == 1:
        P = np.vstack([P, P]); R = np.hstack([R, R]); Zs = np.hstack([Zs, Zs])
    for i in range(len(P) - 1):
        a = np.array([P[i, 0], P[i, 1], Zs[i]]); b = np.array([P[i + 1, 0], P[i + 1, 1], Zs[i + 1]])
        ra, rb = R[i], R[i + 1]; rm = max(ra, rb)
        sx = g.sl(0, min(a[0], b[0]) - rm, max(a[0], b[0]) + rm)
        sy = g.sl(1, min(a[1], b[1]) - rm, max(a[1], b[1]) + rm)
        sz = g.sl(2, min(a[2], b[2]) - rm, max(a[2], b[2]) + rm)
        if sx.stop <= sx.start or sy.stop <= sy.start or sz.stop <= sz.start: continue
        X = g.X[sx][:, None, None]; Y = g.Y[sy][None, :, None]; Z = g.Z[sz][None, None, :]
        ab = b - a; L2 = float(ab @ ab) or 1e-9
        t = ((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2
        t = np.clip(t, 0, 1)
        dx = X - (a[0] + t * ab[0]); dy = Y - (a[1] + t * ab[1]); dz = Z - (a[2] + t * ab[2])
        r = ra + (rb - ra) * t
        m = dx * dx + dy * dy + dz * dz <= r * r
        out.append(((sx, sy, sz), m))
    return out


def raster_ell(g, p, sign=1.0):
    cx, cy = p['c']; rx, ry, rz = max(p['rx'], 0.55 * g.v), max(p['ry'], 0.55 * g.v), max(p['rz'], 0.55 * g.v)
    zc = p['zc'] * sign
    if p['far']: zc = -abs(zc) if sign > 0 else abs(zc)
    R = max(rx, ry)
    sx = g.sl(0, cx - R, cx + R); sy = g.sl(1, cy - R, cy + R); sz = g.sl(2, zc - rz, zc + rz)
    if sx.stop <= sx.start or sy.stop <= sy.start or sz.stop <= sz.start: return []
    X = g.X[sx][:, None, None] - cx; Y = g.Y[sy][None, :, None] - cy; Z = g.Z[sz][None, None, :] - zc
    c, s = math.cos(p['ang']), math.sin(p['ang'])
    u = X * c + Y * s; w = -X * s + Y * c
    m = (u / rx) ** 2 + (w / ry) ** 2 + (Z / rz) ** 2 <= 1
    return [((sx, sy, sz), m)]


def poly2d(g, p, pad=0.0):
    P = np.array(p['pts'])
    sx = g.sl(0, P[:, 0].min() - pad, P[:, 0].max() + pad); sy = g.sl(1, P[:, 1].min() - pad, P[:, 1].max() + pad)
    if sx.stop <= sx.start or sy.stop <= sy.start: return None
    X, Y = np.meshgrid(g.X[sx], g.Y[sy], indexing='ij')
    m = Path(P).contains_points(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
    if not m.any(): return None
    d = ndi.distance_transform_edt(np.pad(m, 1), sampling=g.v)[1:-1, 1:-1]
    return sx, sy, X, Y, m, d


def profile(p, d, dmax, th, v):
    if p.get('prof') == 'slab':
        return th * np.sqrt(np.clip(d / np.maximum(th, v), 0, 1))
    k = np.clip(d / max(0.85 * dmax, v), 0, 1)
    return th * np.sqrt(1 - (1 - k) ** 2)


def raster_poly(g, p, sign=1.0):
    r = poly2d(g, p)
    if r is None: return []
    sx, sy, X, Y, m, d = r
    dmax = d.max()
    if p.get('thx'): th = pw(p['thx'], localx(p, X, Y))
    elif p['th'] is not None: th = np.full(X.shape, p['th'])
    else: th = np.full(X.shape, dmax)
    h = profile(p, d, dmax, th, g.v)
    h = np.maximum(h, 0.55 * g.v) * m
    if p.get('zx'): zc = pw(p['zx'], localx(p, X, Y))
    else: zc = np.full(X.shape, p['z'])
    zc = zc * sign
    hmax = h.max(); zlo = zc[m].min() - hmax; zhi = zc[m].max() + hmax
    sz = g.sl(2, zlo, zhi)
    if sz.stop <= sz.start: return []
    Z = g.Z[sz][None, None, :]
    mm = (np.abs(Z - zc[:, :, None]) <= h[:, :, None]) & m[:, :, None]
    return [((sx, sy, sz), mm)]


def raster(g, p):
    f = {'tube': raster_tube, 'ell': raster_ell, 'poly': raster_poly}[p['kind']]
    out = f(g, p, 1.0)
    if p.get('mirror'):
        out += f(g, p, -1.0)
    return out


def carve_recess(g, B, p):
    r = poly2d(g, p) if p['kind'] == 'poly' else None
    if p['kind'] == 'ell':
        cx, cy = p['c']; R = max(p['rx'], p['ry'])
        sx = g.sl(0, cx - R, cx + R); sy = g.sl(1, cy - R, cy + R)
        X, Y = np.meshgrid(g.X[sx], g.Y[sy], indexing='ij')
        c, s = math.cos(p['ang']), math.sin(p['ang'])
        u = (X - cx) * c + (Y - cy) * s; w = -(X - cx) * s + (Y - cy) * c
        q = np.sqrt((u / p['rx']) ** 2 + (w / p['ry']) ** 2)
        m = q <= 1
        prof = np.sqrt(np.clip(1 - q ** 2, 0, 1))
    elif r is not None:
        sx, sy, X, Y, m, d = r
        k = np.clip(d / max(0.85 * d.max(), g.v), 0, 1)
        prof = np.sqrt(1 - (1 - k) ** 2)
    else:
        return
    depth = (p.get('depth') if p.get('depth') is not None else 0.6) * prof * m
    z0 = p.get('zc', p.get('z', 0.0)) or 0.0
    sub = B[sx, sy, :]
    Z = g.Z[None, None, :]
    for side in (1, -1):
        cond = sub & ((Z - z0) * side > 0)
        ext = np.where(cond, (Z - z0) * side, -np.inf).max(axis=2)
        ok = np.isfinite(ext) & m
        cut = cond & ok[:, :, None] & ((Z - z0) * side > (ext * (1 - 0.85 * depth))[:, :, None])
        sub[cut] = False
    B[sx, sy, :] = sub


def apply_mask(vol, parts, value=True):
    for (sx, sy, sz), m in parts:
        if value: vol[sx, sy, sz] |= m
        else: vol[sx, sy, sz] &= ~m


def sdf(M, v):
    return (ndi.distance_transform_edt(~M, sampling=v) - ndi.distance_transform_edt(M, sampling=v)).astype(np.float32)


def close_mask(M, r, v):
    D = ndi.distance_transform_edt(~M, sampling=v)
    dil = D <= r
    E = ndi.distance_transform_edt(dil, sampling=v)
    return (E > r) | M


def mesh(field, g, target):
    verts, faces, _, _ = marching_cubes(field, 0.0, spacing=(g.v,) * 3, allow_degenerate=False)
    verts = verts + g.lo
    # orient faces outward (sdf increases outward)
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    n = np.cross(b - a, c - a)
    cen = (a + b + c) / 3
    nn = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    probe = sample(field, g, cen + nn * g.v * 0.8) - sample(field, g, cen - nn * g.v * 0.8)
    if np.mean(probe > 0) < 0.5: faces = faces[:, ::-1]
    if len(faces) > target:
        verts, faces = fsimp.simplify(verts.astype(np.float32), faces.astype(np.int64), target_reduction=1 - target / len(faces))
    return np.asarray(verts, np.float64), np.asarray(faces, np.int64)


def sample(field, g, P, order=1):
    idx = ((P - g.lo) / g.v).T
    return ndi.map_coordinates(field, idx, order=order, mode='nearest')


def vnormals(V, F):
    n = np.zeros_like(V)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def project(P, field, grads, g, iters=6):
    P = P.copy()
    for _ in range(iters):
        d = sample(field, g, P)
        gr = np.stack([sample(gg, g, P) for gg in grads], 1)
        gr /= (np.linalg.norm(gr, axis=1, keepdims=True) + 1e-9)
        P -= gr * d[:, None]
    return P


def noise3(P, f):
    Q = P * f
    I = np.floor(Q).astype(np.int64); Fr = Q - I
    def h(ix, iy, iz):
        x = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)
        x = (x ^ (x >> 13)) * 1274126177
        return ((x ^ (x >> 16)) & 0xffff) / 65535.0
    u = Fr * Fr * (3 - 2 * Fr)
    acc = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                acc = acc + w * h(I[:, 0] + dx, I[:, 1] + dy, I[:, 2] + dz)
    return acc


def bake(aid):
    t0 = time.time()
    data = json.load(open(ROOT + f'build/prims/{aid}.json'))
    meta, prims, eyes = data['meta'], data['prims'], data['eyes']
    v = meta['vox']
    pad = meta['wrap'] + meta['skinT'] + 2 * meta['blend'] + meta['furAmp'] + 6 * v
    ex = [prim_extent(p) for p in prims if p['layer'] in ('bone', 'teeth', 'teethX', 'tissue', 'ctissue')]
    lo = [min(e[0] for e in ex) - pad, min(e[2] for e in ex) - pad, -max(e[4] for e in ex) - pad]
    hi = [max(e[1] for e in ex) + pad, max(e[3] for e in ex) + pad, max(e[4] for e in ex) + pad]
    g = Grid(lo, hi, v)
    print(aid, 'grid', g.shape, f'{np.prod(g.shape) / 1e6:.1f}M voxels')
    B = np.zeros(g.shape, bool); TN = np.zeros(g.shape, bool); TX = np.zeros(g.shape, bool); TS = np.zeros(g.shape, bool)
    CID = np.zeros(g.shape, np.int16); BARE = np.zeros(g.shape, bool); SPEC = np.zeros(g.shape, np.uint8)
    palette = [[0, 0, 0]]
    CT = np.zeros(g.shape, bool); CCID = np.zeros(g.shape, np.int16); CBARE = np.zeros(g.shape, bool); CSPEC = np.zeros(g.shape, np.uint8)
    cpal = [[0, 0, 0]]
    for p in prims:
        L = p['layer']
        if L == 'recess':
            carve_recess(g, B, p); continue
        if L == 'hole':
            th = p.get('holeTh') or p.get('th') or 1e4
            q = dict(p)
            if q['kind'] == 'ell':
                q['rz'] = th; q['zc'] = 0.0
            else:
                q['th'] = th; q['thx'] = None; q['prof'] = 'slab'; q['z'] = 0.0; q['zx'] = None; q['mirror'] = False
            parts = raster(g, q)
            # holes cut straight through
            for (sx, sy, sz), m in parts:
                col = m.any(axis=2)
                B[sx, sy, :] &= ~col[:, :, None]; TN[sx, sy, :] &= ~col[:, :, None]; TX[sx, sy, :] &= ~col[:, :, None]
            continue
        parts = raster(g, p)
        if L == 'bone':
            apply_mask(B, parts)
        elif L in ('teeth', 'teethX'):
            apply_mask(B, parts); apply_mask(TX if L == 'teethX' else TN, parts)
        elif L in ('tissue', 'ctissue'):
            cur = L == 'ctissue'
            vol, cidv, barev, specv, pal = (CT, CCID, CBARE, CSPEC, cpal) if cur else (TS, CID, BARE, SPEC, palette)
            apply_mask(vol, parts)
            cid = 0
            if p.get('color'):
                pal.append(hexcol(p['color'])); cid = len(pal) - 1
            bare = p.get('fur') is False
            for (sx, sy, sz), m in parts:
                cidv[sx, sy, sz][m] = cid
                barev[sx, sy, sz][m] = bare
                specv[sx, sy, sz][m] = int((p.get('spec') if p.get('spec') is not None else 0.25) * 255) if bare else 10
    print(' rasterised', round(time.time() - t0, 1), 's')

    T = TN | TX
    Bnt = B & ~T
    # ---- bone
    fB = ndi.gaussian_filter(sdf(B, v), 0.6)
    # ---- shrink-wrap
    rc, sk = meta['wrap'], meta['skinT']
    S0 = close_mask(Bnt, rc, v)
    fS0 = sdf(S0, v) - sk
    fS = np.minimum(fS0, sdf(T, v) - 0.4 * v) if T.any() else fS0
    fS = ndi.gaussian_filter(fS, 0.9)
    # ---- alive
    L0 = (fS0 < 0) | TS
    Lc = close_mask(L0, meta['blend'], v)
    fL = sdf(Lc, v)
    if TX.any(): fL = np.minimum(fL, sdf(TX, v) - 0.4 * v)
    fL = ndi.gaussian_filter(fL, 1.2)
    # ---- the curator's reconstruction
    cm = meta.get('curator') or {}
    Cc = close_mask((fS0 < 0) | CT, meta['blend'], v)
    fC = sdf(Cc, v)
    # teeth the bones show outside the mouth (tusks, crocodile teeth) stay; the rest only if the curator bares them
    TC = T if cm.get('exposeTeeth') else TX
    if TC.any(): fC = np.minimum(fC, sdf(TC, v) - 0.4 * v)
    TCsoft = ndi.gaussian_filter(TC.astype(np.float32), 0.8)
    fC = ndi.gaussian_filter(fC, 1.2)
    print(' fields', round(time.time() - t0, 1), 's')

    solidB = ndi.gaussian_filter((fB < 0).astype(np.float32), 3)
    solidS = ndi.gaussian_filter((fS < 0).astype(np.float32), 3)
    solidL = ndi.gaussian_filter((fL < 0).astype(np.float32), 4)
    solidC = ndi.gaussian_filter((fC < 0).astype(np.float32), 4)
    Tsoft = ndi.gaussian_filter(T.astype(np.float32), 0.8)
    TXsoft = ndi.gaussian_filter(TX.astype(np.float32), 0.8)

    out = {}
    # bone mesh
    VB, FB = mesh(fB, g, TARGET['bone'])
    nB = vnormals(VB, FB)
    aoB = np.clip(1.15 - 1.5 * sample(solidB, g, VB + nB * 2 * v), 0.3, 1)
    toothB = sample(Tsoft, g, VB - nB * 0.5 * v) > 0.3
    colB = np.where(toothB[:, None], meta['toothCol'], meta['boneCol']) * aoB[:, None]
    out['bone'] = dict(V=VB, F=FB, col=colB)
    # wrap mesh, morph start on the bones
    VS, FS = mesh(fS, g, TARGET['wrap'])
    nS = vnormals(VS, FS)
    gB = np.gradient(fB)
    VS0 = project(VS, fB, gB, g)
    del gB
    aoS = np.clip(1.15 - 1.5 * sample(solidS, g, VS + nS * 2 * v), 0.3, 1)
    toothS = sample(Tsoft, g, VS - nS * 0.8 * v) > 0.25
    colS = np.where(toothS[:, None], meta['toothCol'], meta['skinCol']) * aoS[:, None]
    colS0 = np.where(toothS[:, None], meta['toothCol'], meta['boneCol']) * aoS[:, None]
    out['wrap'] = dict(V=VS, V0=VS0, F=FS, col=colS, col0=colS0)
    # curator's mesh, morph start on the wrap
    gS = np.gradient(fS)
    VC, FC = mesh(fC, g, TARGET['curator'])
    nC = vnormals(VC, FC)
    VC0 = project(VC, fS, gS, g)
    del gS
    def look(V, n, cidv, barev, specv):
        q = V - n * 1.6 * v
        ci = np.rint((q - g.lo) / v).astype(int)
        for k in range(3): ci[:, k] = np.clip(ci[:, k], 0, g.shape[k] - 1)
        return cidv[ci[:, 0], ci[:, 1], ci[:, 2]], barev[ci[:, 0], ci[:, 1], ci[:, 2]], specv[ci[:, 0], ci[:, 1], ci[:, 2]]
    ccid, cbare, cspec = look(VC, nC, CCID, CBARE, CSPEC)
    ctooth = sample(TCsoft, g, VC - nC * 0.8 * v) > 0.25
    if cm.get('fur') and cm.get('furAmp', 0) > 0:
        nn = noise3(VC, 1 / 5.0) * 0.6 + noise3(VC + 17.3, 1 / 2.2) * 0.4
        VC = VC + nC * (cm['furAmp'] * (0.15 + 0.85 * nn) * (~cbare) * (~ctooth))[:, None]
    aoC = np.clip(1.12 - 1.2 * sample(solidC, g, VC + nC * 3 * v), 0.4, 1)
    cpalA = np.array(cpal, np.float64)
    colC = cpalA[ccid]; colC[ctooth] = meta['toothCol']
    colC0 = np.where(ctooth[:, None], meta['toothCol'], meta['skinCol'])
    out['curator'] = dict(V=VC, V0=VC0, F=FC, col=colC, col0=colC0, coat=((ccid == 0) & ~ctooth).astype(np.uint8), ao=(aoC * 255).astype(np.uint8),
                          gloss=np.where(ctooth, 140, np.where(cbare, cspec, 10)).astype(np.uint8))
    # living mesh, morph start on the curator's model
    VL, FL = mesh(fL, g, TARGET['alive'])
    nL = vnormals(VL, FL)
    gC = np.gradient(fC)
    VL0 = project(VL, fC, gC, g)
    del gC
    inner = VL - nL * 1.6 * v
    ci = np.rint((inner - g.lo) / v).astype(int)
    for k in range(3): ci[:, k] = np.clip(ci[:, k], 0, g.shape[k] - 1)
    cid = CID[ci[:, 0], ci[:, 1], ci[:, 2]]
    bare = BARE[ci[:, 0], ci[:, 1], ci[:, 2]]
    spec = SPEC[ci[:, 0], ci[:, 1], ci[:, 2]]
    tx = sample(TXsoft, g, VL - nL * 0.8 * v) > 0.25
    if meta.get('fur') and meta['furAmp'] > 0:
        n = noise3(VL, 1 / 5.0) * 0.6 + noise3(VL + 17.3, 1 / 2.2) * 0.4
        disp = meta['furAmp'] * (0.15 + 0.85 * n) * (~bare) * (~tx)
        VL = VL + nL * disp[:, None]
    aoL = np.clip(1.12 - 1.2 * sample(solidL, g, VL + nL * 3 * v), 0.4, 1)
    pal = np.array(palette, np.float64)
    colL = pal[cid]
    coat = (cid == 0) & ~tx
    colL[tx] = meta['toothCol']
    # starting colour = the curator's colour where the living vertex begins
    c0cid, _, _ = look(VL0, nL, CCID, CBARE, CSPEC)
    tm0 = sample(TCsoft, g, VL0 - nL * 0.8 * v) > 0.25
    colL0 = cpalA[c0cid].copy(); colL0[tm0] = meta['toothCol']
    coat0 = (c0cid == 0) & ~tm0
    gloss = np.where(tx, 140, np.where(bare, spec, 10)).astype(np.uint8)
    out['alive'] = dict(V=VL, V0=VL0, F=FL, col=colL, col0=colL0, coat=coat.astype(np.uint8), coat0=coat0.astype(np.uint8), ao=(aoL * 255).astype(np.uint8), gloss=gloss)

    # eyes, both sides
    ex = []
    for e in eyes:
        i = int(np.clip(round((e['x'] - g.lo[0]) / v), 0, g.shape[0] - 1)); j = int(np.clip(round((e['y'] - g.lo[1]) / v), 0, g.shape[1] - 1))
        for s in (1, -1):
            colS_ = fS[i, j, :] < 0; colL_ = (fC if e.get('stage') == 'C' else fL)[i, j, :] < 0
            zz = g.Z * s
            zsS = zz[colS_].max() if colS_.any() else 0.0
            zsL = zz[colL_].max() if colL_.any() else zsS
            if e.get('z') is not None: zsS = max(zsS, abs(e['z'])); zsL = max(zsL, abs(e['z']))
            ex.append(dict(stage=e.get('stage', 'L'), x=e['x'], y=e['y'], zS=s * (zsS - 0.3 * e['rS']), zL=s * (zsL - 0.5 * e['r']), r=e['r'], rS=e['rS'], side=s,
                           iris=e['iris'], irisHi=e['irisHi'], pupil=e['pupil'], pupilR=e['pupilR']))
    print(' meshes', {k: len(m['F']) for k, m in out.items()}, round(time.time() - t0, 1), 's')
    write(aid, meta, out, ex)


def write(aid, meta, out, eyes):
    upm = meta['unitsPerM']; gy = meta.get('groundY') or 560
    allV = np.vstack([out['alive']['V'], out['bone']['V']])
    xc = float((allV[:, 0].min() + allV[:, 0].max()) / 2)

    def tom(V):  # world units -> metres, y up
        return np.c_[(V[:, 0] - xc) / upm, (gy - V[:, 1]) / upm, V[:, 2] / upm]

    blobs = []; man = {'id': aid, 'xc': xc, 'groundY': gy, 'upm': upm, 'meshes': {}, 'eyes': []}
    def add(name, arr):
        arr = np.ascontiguousarray(arr)
        off = sum(len(b) for b in blobs)
        pad = (-off) % 4
        if pad: blobs.append(b'\0' * pad); off += pad
        blobs.append(arr.tobytes())
        return {'o': off, 'n': int(arr.size), 't': {np.uint16: 'u16', np.uint8: 'u8', np.uint32: 'u32', np.float32: 'f32'}[arr.dtype.type]}

    for name, m in out.items():
        V = tom(m['V']); allp = [V]
        if 'V0' in m: allp.append(tom(m['V0']))
        P = np.vstack(allp); lo = P.min(0); hi = P.max(0); rng = np.maximum(hi - lo, 1e-6)
        q = lambda A: np.rint((A - lo) / rng * 65535).astype(np.uint16)
        F = m['F'][:, ::-1]  # y flip mirrors the mesh, so restore outward winding
        ent = {'lo': lo.tolist(), 'rng': rng.tolist(), 'count': int(len(V))}
        ent['pos'] = add('pos', q(V))
        if 'V0' in m: ent['pos0'] = add('pos0', q(tom(m['V0'])))
        ent['idx'] = add('idx', F.astype(np.uint16 if len(V) < 65536 else np.uint32).ravel())
        ent['col'] = add('col', np.clip(m['col'], 0, 255).astype(np.uint8).ravel())
        if 'col0' in m: ent['col0'] = add('col0', np.clip(m['col0'], 0, 255).astype(np.uint8).ravel())
        for k in ('coat', 'coat0', 'ao', 'gloss'):
            if k in m: ent[k] = add(k, m[k].astype(np.uint8))
        man['meshes'][name] = ent
    for e in eyes:
        man['eyes'].append(dict(e, x=(e['x'] - xc) / upm, y=(gy - e['y']) / upm, zS=e['zS'] / upm, zL=e['zL'] / upm, r=e['r'] / upm, rS=e['rS'] / upm))
    import base64
    man['bin'] = base64.b64encode(b''.join(blobs)).decode()
    json.dump(man, open(ROOT + f'data/{aid}.json', 'w'), separators=(',', ':'))
    print(' wrote', aid, sum(len(b) for b in blobs) // 1024, 'KB')


if __name__ == '__main__':
    import os
    os.makedirs(ROOT + 'data', exist_ok=True)
    for a in (sys.argv[1:] or ['cat', 'elephant', 'swan', 'bison', 'owl', 'crocodile']):
        bake(a)
