import type { ReactNode } from "react";

import { strings } from "../strings";

type PanelProps = {
  /** Whether the panel is open. On a screen wide enough for two columns it always is. */
  readonly expanded: boolean;
  readonly onExpand: (expanded: boolean) => void;
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
 * front of the player is a control with nothing to do. On a phone there is no
 * room, so it folds down to the handle at the foot of the screen and opens above
 * it — and closes again, which is the point of folding rather than scrolling: the
 * room the panel takes comes back to the board when the player is done reading.
 *
 * Which of the two it is, is the stylesheet's business and not this component's.
 * The panel is the same panel either way, and a component that asked how wide
 * the window was would be a second opinion about that with its own way of being
 * wrong.
 */
export const Panel = ({ expanded, onExpand, children }: PanelProps) => (
  <section className="panel" data-testid="panel" data-expanded={expanded ? "" : undefined}>
    <button
      type="button"
      className="panel__handle"
      data-testid="panel-handle"
      aria-expanded={expanded}
      aria-controls={CONTENTS}
      onClick={() => onExpand(!expanded)}
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
