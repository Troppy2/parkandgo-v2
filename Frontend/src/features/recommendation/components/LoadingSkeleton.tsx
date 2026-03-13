import Skeleton from "../../../components/ui/Skeleton";

export default function LoadingSkeleton() {
  return (

<div className="flex flex-col gap-2.5 p-4">
  {[1, 2, 3].map((i) => (
    <div key={i} className="mb-4">
      <Skeleton className="h-[62px] w-full mb-2" /> 
      <Skeleton className="h-20 w-full" /> 
    </div>
  ))}
</div>
  );
}
