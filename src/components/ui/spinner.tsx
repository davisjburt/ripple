
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const spinnerVariants = cva(
    "text-muted-foreground animate-spin",
    {
        variants: {
            size: {
                small: "h-4 w-4",
                medium: "h-6 w-6",
                large: "h-8 w-8",
                icon: "h-5 w-5",
            },
        },
        defaultVariants: {
            size: "medium",
        }
    }
);

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {}

export const Spinner = ({ size }: SpinnerProps) => {
    return (
        <Loader2 className={cn(spinnerVariants({size}))} />
    );
};
