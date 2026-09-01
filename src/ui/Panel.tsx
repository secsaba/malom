import { type ReactNode } from "react";

type PanelProps = {
  /** Everything the page shows beside the board. */
  readonly children: ReactNode;
};

/**
 * The panel: what teaching has to say about the game, the record of it, and the
 * settings — everything the page shows that is not the board or the state of
 * play beside it.
 *
 * On a wide screen it stands next to the board: there is room for both. On a
 * phone there is one column, so it stands below the board and is reached by
 * scrolling to it. It costs the board nothing either way — the board is drawn
 * from the screen — so what the panel needs is more page rather than less
 * board.
 *
 * Which of the two it is, is the stylesheet's business and not this component's.
 * The panel is the same panel either way, and a component that asked how wide
 * the window was would be a second opinion about that with its own way of being
 * wrong.
 */
export const Panel = ({ children }: PanelProps) => (
  <section className="panel" data-testid="panel">
    <div className="panel__contents" data-testid="panel-contents">
      {children}
    </div>
  </section>
);
