import { describe, expect, it } from 'vitest';
import { sniffImage } from './upload';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(Math.max(0, 12 - b.length)).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('sniffImage', () => {
  it('recognises JPEG, PNG and WebP by content', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ type: 'image/jpeg', ext: 'jpg' });
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ type: 'image/png', ext: 'png' });
    expect(sniffImage(new Uint8Array([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')]))).toEqual({ type: 'image/webp', ext: 'webp' });
  });
  it('rejects HTML, SVG, scripts, GIF, RIFF that is not WebP, and empty input', () => {
    for (const text of ['<!doctype html><script>alert(1)</script>', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'GIF89a......', '#!/bin/sh']) {
      expect(sniffImage(new Uint8Array(ascii(text)))).toBeNull();
    }
    expect(sniffImage(new Uint8Array([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')]))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });
});
