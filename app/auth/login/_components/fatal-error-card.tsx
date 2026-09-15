import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FatalErrorCardProps = {
  message: string;
};

export function FatalErrorCard({ message }: FatalErrorCardProps) {
  return (
    <Card className="mt-12 w-full max-w-md">
      <CardHeader>
        <CardTitle>Authentication stopped</CardTitle>
        <CardDescription role="alert">{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          className="w-full"
          onClick={() => window.location.reload()}
        >
          Restart authentication
        </Button>
      </CardContent>
    </Card>
  );
}
