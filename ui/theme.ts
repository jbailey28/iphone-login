/**
 * The look, in one place (change it to match the app). Every gap comes from one
 * 8-point base, so nothing sits slightly off.
 */
const base = 8;

export const theme = {
  space: { s: base, m: base * 2, l: base * 3, xl: base * 4, xxl: base * 6 },
  radius: base * 1.5,
  control: base * 6, // height of every button and box
  color: {
    background: '#FFFFFF',
    text: '#111114',
    muted: '#6B6B73',
    line: '#E3E3E8',
    box: '#F4F4F6',
    action: '#111114',
    actionText: '#FFFFFF',
    danger: '#C7302A',
  },
  type: { title: 28, body: 17, small: 15 },
} as const;
