"use client";

import { Image as ImageIcon } from "lucide-react";

// Adding quick-fill dummy data to help with the presentation
const DEMO_SAMPLES = [
    {
        name: "Political Rally (Real)",
        path: "/samples/real_person_1.jpg",
        context: "Recent political rally in capital"
    },
    {
        name: "News Anchor (Fake)",
        path: "/samples/ai_generated_person_1.jpg",
        context: "Oil strike announcement"
    }
];

export function DemoPicker({ onSelect }: { onSelect: (file: File, context: string) => void }) {
    const handleSelect = async (path: string, context: string, name: string) => {
        try {
            const res = await fetch(path);
            const blob = await res.blob();
            const file = new File([blob], name, { type: "image/jpeg" });
            onSelect(file, context);
        } catch {
            alert("Failed to load sample. Ensure you've placed it in the public folder.");
        }
    };

    return (
        <div className="mt-8 pt-6 border-t border-white/10 w-full flex flex-col gap-3">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider text-center">Hackathon Demo Quick-Select</p>
            <div className="grid grid-cols-2 gap-2">
                {DEMO_SAMPLES.map((sample, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => handleSelect(sample.path, sample.context, sample.name)}
                        className="flex items-center justify-center gap-2 bg-white/5 border border-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-colors p-3 rounded-lg text-xs text-gray-300"
                    >
                        <ImageIcon size={14} className="text-indigo-400" />
                        {sample.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
