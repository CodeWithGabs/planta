/** Permite que o editor 2D trate teclas de desenho antes dos atalhos globais. */
export const drawKeys: { handler: ((e: KeyboardEvent) => boolean) | null } = { handler: null };
