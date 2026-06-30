import { ReactNode } from 'react';

export type MenuSection = {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: MenuSection[];
};

type SidebarProps = {
  sections: MenuSection[];
  activeSection: string;
  onChange: (id: string) => void;
};

export default function Sidebar({ sections, activeSection, onChange }: SidebarProps) {
  return (
    <aside className="sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto rounded-[40px] border border-white/10 bg-[#09090B]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-300">A</div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Admin</p>
          <h2 className="text-xl font-black">WinWave</h2>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => onChange(section.id)}
              className={`group flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition ${
                activeSection === section.id ? 'bg-amber-500/15 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {section.icon}
              <span className="font-semibold">{section.label}</span>
            </button>

            {section.children && activeSection.startsWith(section.id) && (
              <div className="mt-2 space-y-2 pl-8">
                {section.children.map((child) => (
                  <button
                    type="button"
                    key={child.id}
                    onClick={() => onChange(child.id)}
                    className={`flex w-full items-center gap-2 rounded-3xl px-4 py-3 text-left text-sm transition ${
                      activeSection === child.id ? 'bg-amber-500/15 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {child.icon}
                    <span>{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
