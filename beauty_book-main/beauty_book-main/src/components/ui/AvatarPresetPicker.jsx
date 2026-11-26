const AVATAR_PRESETS = [
  { label: "Nova", seed: "Nova", background: "fde68a" },
  { label: "Milo", seed: "Milo", background: "bfdbfe" },
  { label: "Aya", seed: "Aya", background: "fbcfe8" },
  { label: "Lina", seed: "Lina", background: "bbf7d0" },
  { label: "Sam", seed: "Sam", background: "ddd6fe" },
  { label: "Kaya", seed: "Kaya", background: "fed7aa" },
];

export const avatarPresetUrl = (seed, background) =>
  `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${background}`;

export default function AvatarPresetPicker({ selectedUrl, onSelect }) {
  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Avatar illustré</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {AVATAR_PRESETS.map((preset) => {
          const url = avatarPresetUrl(preset.seed, preset.background);
          const selected = selectedUrl === url;
          return (
            <button
              key={preset.seed}
              type="button"
              onClick={() => onSelect?.(url)}
              aria-label={`Choisir l’avatar ${preset.label}`}
              aria-pressed={selected}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 bg-white transition-transform active:scale-90 ${selected ? "border-primary ring-2 ring-primary/20" : "border-white"}`}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
