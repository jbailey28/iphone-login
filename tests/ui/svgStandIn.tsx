import type { ReactNode } from 'react';

// The pretend browser can't draw react-native-svg, so the logo is an empty box.
export default function Svg({ children }: { children?: ReactNode }) {
  return <span data-logo="">{children}</span>;
}
export function Path() {
  return null;
}
