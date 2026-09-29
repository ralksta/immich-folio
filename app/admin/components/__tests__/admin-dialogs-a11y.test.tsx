// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useModalDialog } from '@/hooks/useModalDialog';
import AlbumPicker from '../AlbumPicker';
import AlbumDrawer from '../page-builder/AlbumDrawer';
import { StorySettingsModal } from '../journal/StorySettingsModal';

afterEach(() => {
  cleanup();
});

function Dialog({
  name,
  onClose,
  children,
}: {
  name: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useModalDialog(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={name}>
      <button type="button">{name} first</button>
      {children}
      <button type="button">{name} last</button>
    </div>
  );
}

const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

describe('useModalDialog with nested dialogs (A-9)', () => {
  it('Escape closes only the innermost dialog', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const { rerender } = render(<Dialog name="outer" onClose={closeOuter} />);
    rerender(
      <Dialog name="outer" onClose={closeOuter}>
        <Dialog name="inner" onClose={closeInner} />
      </Dialog>,
    );
    escape();
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    // Once the inner one is gone, the outer one answers again.
    rerender(<Dialog name="outer" onClose={closeOuter} />);
    escape();
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to an expanded combobox', () => {
    const close = vi.fn();
    render(
      <Dialog name="d" onClose={close}>
        <button type="button" role="combobox" aria-expanded="true" aria-controls="x">
          sort
        </button>
      </Dialog>,
    );
    screen.getByRole('combobox').focus();
    escape();
    expect(close).not.toHaveBeenCalled();
  });

  it('leaves Escape to an item picked up with the keyboard (dnd-kit)', () => {
    const close = vi.fn();
    render(
      <Dialog name="d" onClose={close}>
        <div role="button" tabIndex={0} aria-roledescription="sortable" aria-pressed="true">
          tile
        </div>
      </Dialog>,
    );
    screen.getByText('tile').focus();
    escape();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('AlbumPicker from the keyboard (A-10)', () => {
  const albums = [
    {
      id: 'a1',
      albumName: 'Alps',
      description: '',
      thumbnailAssetId: null,
      assetCount: 3,
      isConfigured: false,
    },
    {
      id: 'a2',
      albumName: 'Baltic',
      description: '',
      thumbnailAssetId: null,
      assetCount: 5,
      isConfigured: true,
    },
  ];

  it('offers each free album as a button and disables the ones in use', () => {
    const onSelect = vi.fn();
    render(
      <AlbumPicker
        albums={albums}
        onSelect={onSelect}
        onClose={() => {}}
        usedAlbumIds={new Set(['a2'])}
      />,
    );
    const alps = screen.getByRole('button', { name: /Alps/ });
    const baltic = screen.getByRole('button', { name: /Baltic/ }) as HTMLButtonElement;
    expect(baltic.disabled).toBe(true);
    fireEvent.click(alps);
    expect(onSelect).toHaveBeenCalledWith('a1');
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <AlbumPicker
        albums={albums}
        onSelect={() => {}}
        onClose={onClose}
        usedAlbumIds={new Set()}
      />,
    );
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AlbumDrawer as a dialog (A-9)', () => {
  it('is a labelled modal dialog that closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <AlbumDrawer
        album={{ id: 'a1' }}
        name="Alps"
        count={3}
        thumbnailId={null}
        onUpdate={() => {}}
        onRemove={() => {}}
        onClose={onClose}
        onPickHero={() => {}}
        onEditOrder={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /Edit Album Details/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('StorySettingsModal as a dialog (A-9)', () => {
  it('is a labelled modal dialog that closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <StorySettingsModal
        frontmatter={{ title: 'Trip' }}
        onChange={() => {}}
        onPickAsset={() => {}}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /Story Settings/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
