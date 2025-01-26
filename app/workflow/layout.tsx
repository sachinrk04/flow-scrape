import React, { ReactNode } from "react";
import Logo from "@/components/Logo";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { Separator } from "@/components/ui/separator";

const layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col w-full h-screen">
      {children}
      <Separator />
      <footer className="flex justify-between items-center p-2">
        <Logo iconSize={16} fonySize="text-xl" />
        <ThemeModeToggle />
      </footer>
    </div>
  );
};

export default layout;
