import * as React from 'react';

/** Sunken text field — search, terminal command line, agent composer, settings. */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** Leading slot (icon). */
  leading?: React.ReactNode;
  /** Trailing slot (icon or send button). */
  trailing?: React.ReactNode;
  /** Use the monospace family + code size (terminal / command). @default false */
  mono?: boolean;
  disabled?: boolean;
  /** Style for the field wrapper. */
  style?: React.CSSProperties;
  /** Style for the inner <input>. */
  inputStyle?: React.CSSProperties;
}

export function Input(props: InputProps): React.JSX.Element;
