# Prompt to paste into Claude Code

Open this folder in Claude Code, then paste the text below:

---

Build the Coco's Art e-commerce website from this folder.

1. Read `HANDOFF.md` fully first. It is the spec.
2. Use `design-reference/Main.reference.html` and `design-reference/Shop.reference.html` as the
   visual source of truth for layout, copy, colours, typography and animation CSS. They are in a
   prototyping format (`{{}}` bindings, `<sc-for>`, `<sc-if>`, a `DCLogic` class). Translate them
   into clean React components and do not reuse that runtime.
3. Stack: React + Vite + TypeScript + React Router. Use Tailwind with the tokens from HANDOFF §4.
   Use a persisted cart store under the localStorage key `coco-cart`.
4. Product data comes from `data/products.json` (80 products). Images are in `public/images`.
   Never invent prices: `price: null` shows "Price pending".
5. Follow HANDOFF §7 exactly for the cart:
   - Add to cart does NOT open the drawer.
   - Play the fly-to-cart animation, then the bottom floating cart pill bumps and shows the count.
   - Clicking the pill opens the drawer.
6. Shop grid: 4 / 3 / 2 columns, and always 2 columns on phones. Never one per row.
7. Build the routes in HANDOFF §3, including the new product page with a variant picker
   (HANDOFF §8).
8. Put WhatsApp, Facebook, Instagram and other contact placeholders in a single
   `src/config/site.ts`.
9. Work in small commits. Start with: the project scaffold → theme tokens → layout (nav, footer,
   cart drawer, floating cart) → home → shop → product → checkout placeholder.
10. When done, run the dev server and test:
    - the fly-to-cart animation
    - the drawer, including Esc and focus
    - filters and search
    - mobile widths 360 and 390
    - `prefers-reduced-motion`

    Then list anything from HANDOFF §12 that is still open.
