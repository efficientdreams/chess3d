// Piece set registry.
import { buildClassic } from './classic.js';
import { buildMedieval } from './medieval.js';
import { buildModern } from './modern.js';
import { buildCyberpunk } from './cyberpunk.js';

export const PIECE_SETS = {
  classic: { name: 'Classic', blurb: 'Hand-turned Staunton pieces in boxwood & ebony.', build: buildClassic },
  medieval: { name: 'Medieval', blurb: 'Footmen, castle towers, warhorses, bishops and crowned royalty.', build: buildMedieval },
  modern: { name: 'Modern', blurb: 'Minimalist Bauhaus forms in glazed ceramic and brushed metal.', build: buildModern },
  cyberpunk: { name: 'Cyberpunk', blurb: 'Neon-lit gunmetal with hovering holographic cores.', build: buildCyberpunk },
};

export function createPiece(setId, type, color) {
  const set = PIECE_SETS[setId] || PIECE_SETS.classic;
  const obj = set.build(type, color);
  obj.userData.type = type;
  obj.userData.color = color;
  obj.userData.set = setId;
  obj.traverse((o) => { o.userData.pieceRoot = obj; });
  return obj;
}
