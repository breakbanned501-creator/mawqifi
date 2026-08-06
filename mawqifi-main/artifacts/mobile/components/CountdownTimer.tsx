/**
 * CountdownTimer — shows remaining time before departure.
 *
 * Updates every 30 seconds automatically.
 * Color transitions: cyan (lots of time) → amber → red (imminent).
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  departureTime: string;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "الآن";
  if (minutes < 60) return `${minutes} د`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}س ${m}د` : `${h} ساعة`;
}

function getUrgency(minutes: number): "now" | "soon" | "moderate" | "later" {
  if (minutes <= 0) return "now";
  if (minutes <= 5) return "soon";
  if (minutes <= 20) return "moderate";
  return "later";
}

export default function CountdownTimer({ departureTime }: Props) {
  const colors = useColors();

  const [minutesLeft, setMinutesLeft] = useState(() => {
    const diff = new Date(departureTime).getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60_000));
  });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(departureTime).getTime() - Date.now();
      setMinutesLeft(Math.max(0, Math.round(diff / 60_000)));
    };

    // Clear any existing interval before setting up new one
    tick(); // Immediate update on mount/prop change
    const id = setInterval(tick, 30_000);

    return () => clearInterval(id);
  }, [departureTime]);

  const urgency = getUrgency(minutesLeft);
  const urgencyColor =
    urgency === "now" ? colors.destructive
    : urgency === "soon" ? colors.warning
    : urgency === "moderate" ? colors.accent
    : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: `${urgencyColor}18` }]}>
      <Text style={[styles.label, { color: urgencyColor }]}>
        {urgency === "now" ? "يغادر الآن" : `يغادر خلال ${formatMinutes(minutesLeft)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
});
