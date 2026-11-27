import type { ReactNode } from "react";
import CustomerMenu from "@/modules/Menu/CustomerMenu";

export default function OrderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomerMenu mode="table" />
      {children}
    </>
  );
}
