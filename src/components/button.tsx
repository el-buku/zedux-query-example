import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const Button = ({ children, ...props }: ButtonProps) => {
  return (
    <button
      className="py-2.5 px-2 text-base cursor-pointer bg-blue-500 text-white border-none rounded w-fit whitespace-nowrap"
      {...props}
    >
      {children}
    </button>
  );
};
