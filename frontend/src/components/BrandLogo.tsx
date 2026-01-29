import { cn } from "./ui/cn";
import logo from "../assets/logo.png";

type BrandLogoProps = {
  size?: "sm" | "md";
  className?: string;
};

const sizes = {
  sm: "h-7 w-7",
  md: "h-9 w-9"
};

export default function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <img
      src={logo}
      alt="QuizStudy"
      className={cn(
        "rounded-xl object-contain",
        sizes[size],
        className
      )}
    />
  );
}
