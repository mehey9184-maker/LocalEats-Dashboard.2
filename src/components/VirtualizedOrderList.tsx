import React from "react";
import { List as VirtualizedList } from "react-window";
import { Order } from "../types";

interface VirtualizedOrderListProps {
  orders: Order[];
  renderItem: (order: Order, index: number) => React.ReactNode;
  itemHeight?: number;
  height?: number;
  className?: string;
}

export const VirtualizedOrderList: React.FC<VirtualizedOrderListProps> = ({
  orders,
  renderItem,
  itemHeight = 360,
  height = 700,
  className = "",
}) => {
  if (!orders || orders.length === 0) return null;

  return (
    <div className={`w-full ${className}`}>
      <VirtualizedList
        rowCount={orders.length}
        rowHeight={itemHeight}
        overscanCount={2}
        style={{ height: Math.min(orders.length * itemHeight, height), width: "100%" }}
        rowComponent={({ index, style }) => {
          const order = orders[index];
          if (!order) return null;
          return (
            <div style={style} className="pb-4">
              {renderItem(order, index)}
            </div>
          );
        }}
      />
    </div>
  );
};

export default VirtualizedOrderList;
