import * as React from 'react';

/**
 * Flat, dense IDE button used across Capisco chrome and the permission broker.
 * @startingPoint section="Core" subtitle="Flat IDE button — default, primary, ghost" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. @default 'default' */
  variant?: 'default' | 'primary' | 'ghost';
  /** Control height. @default 'sm' */
  size?: 'sm' | 'md';
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): React.JSX.Element;
