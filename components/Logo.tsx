import { cn } from "@/lib/utils";
import { SquareDashedMousePointer } from "lucide-react";
import Link from "next/link";
import React from "react";

const Logo = ({
  fonySize = "text-2xl",
  iconSize = 20,
}: {
  fonySize?: string;
  iconSize?: number;
}) => {
  return (
    <Link
      href="/"
      className={cn(
        "text-2xl font-extrabold flex items-center gap-2",
        fonySize
      )}
    >
      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-2">
        <SquareDashedMousePointer size={iconSize} className="stroke-white" />
      </div>
      <div>
        <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
          Flow
        </span>
        <span className="text-stone-700 dark:text-slate-300">Scrape</span>
      </div>
    </Link>
  );
};

export default Logo;
