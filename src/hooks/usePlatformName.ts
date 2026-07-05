// src/hooks/usePlatformName.ts
// Fetches platform_name from platform_settings and subscribes to realtime changes.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function usePlatformName(fallback = "WinClub") {
  const [name, setName] = useState<string>(fallback);

  useEffect(() => {
    // Initial fetch
    supabase
      .from("platform_settings")
      .select("platform_name")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.platform_name) setName(data.platform_name);
      });

    // Realtime subscription
    const channel = supabase
      .channel("platform-settings-name")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "platform_settings", filter: "id=eq.default" },
        (payload) => {
          const newName = (payload.new as any)?.platform_name;
          if (newName) setName(newName);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  return name;
}
