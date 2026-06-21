import { Avatar, AvatarFallback } from "./avatar";

export const Reviewers = () => (
  <div className="flex items-center gap-2">
    {["MA", "KI", "JD", "LE"].map((initials) => (
      <Avatar key={initials} className="size-6">
        <AvatarFallback className="text-micro">{initials}</AvatarFallback>
      </Avatar>
    ))}
  </div>
);
