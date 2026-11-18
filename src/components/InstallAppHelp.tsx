import { useEffect, useId, useRef } from "react";

type Props = {
  appName: string;
  instructions: string[] | null;
  onClose: () => void;
};

export function InstallAppHelp({ appName, instructions, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border p-5 shadow-xl backdrop:bg-black/50 border-outline-variant/30 bg-surface-container-lowest text-on-surface">
      <h2 id={titleId} className="text-base font-extrabold">Install {appName}</h2>
      {instructions ? (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-5 text-on-surface-variant">
          {instructions.map((step) => <li key={step}>{step}</li>)}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-on-surface-variant">The install prompt is unavailable. Try again in a browser that supports installing web apps.</p>
      )}
      <form method="dialog" className="mt-5 flex justify-end">
        <button type="submit" autoFocus
          className="min-h-11 rounded-xl px-4 text-sm font-bold motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 bg-primary text-on-primary focus-visible:outline-primary">
          Done
        </button>
      </form>
    </dialog>
  );
}
