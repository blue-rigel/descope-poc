import { LoaderCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function InitializingCard() {
  return (
    <Card className="mt-12 w-full max-w-md">
      <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Starting secure sign-in...
      </CardContent>
    </Card>
  );
}
