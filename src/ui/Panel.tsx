import { type ReactNode, useState } from "react";

import { useStrings } from "./language";

type PanelProps = {
  /** Everything the page shows beside the board. */
  readonly children: ReactNode;
};

/** What the handle opens, named so the handle can say what it controls. */
const CONTENTS = "panel-contents";

/**
 * The panel: what teaching has to say about the game, the record of it, and the
 * settings — everything the page shows that is not the board or the state of
 * play beside it.
 *
 * On a wide screen it stands next to the board and the handle is not drawn at
 * all: there is room for both, and a control that folds away what is already in
 * front of the player is a control with nothing to do. On a phone there is only
 * one column, so it stands below the board, folded down to its handle, and opens
 * under it. It costs the board nothing either way — the board is drawn from the
 * screen — so what shutting it buys is a shorter page rather than a bigger
 * board.
 *
 * Which of the two it is, is the stylesheet's business and not this component's.
 * The panel is the same panel either way, and a component that asked how wide
 * the window was would be a second opinion about that with its own way of being
 * wrong.
 *
 * Whether it is open is kept here rather than passed in, because nothing outside
 * the panel reads it: it says how much of the page the player is looking at now,
 * and it is deliberately not written down — that is a state of the reading and
 * not a Setting, and a reload starts the reading again.
 */
export const Panel = ({ children }: PanelProps) => {
  const strings = useStrings();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="panel" data-testid="panel" data-expanded={expanded ? "" : undefined}>
      <button
        type="button"
        className="panel__handle"
        data-testid="panel-handle"
        aria-expanded={expanded}
        aria-controls={CONTENTS}
        onClick={() => setExpanded(!expanded)}
      >
        {strings.panel.handle}
        {/* Which way the handle goes: the one mark here that is not a word. */}
        <span className="panel__chevron" aria-hidden="true" />
      </button>

      <div className="panel__contents" id={CONTENTS} data-testid="panel-contents">
        {children}
      </div>
    </section>
  );
};
