import React from "react";
import { FixedSizeList as VirtualizedList, ListChildComponentProps } from "react-window";
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

  const Row = ({ index, style }: ListChildComponentProps): React.ReactElement => {
    const order = orders[index];
    if (!order) return <div style={style} />;
    return (
      <div style={style} className="pb-4">
        {renderItem(order, index)}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <VirtualizedList
        height={Math.min(orders.length * itemHeight, height)}
        itemCount={orders.length}
        itemSize={itemHeight}
        width="100%"
        overscanCount={2}
      >
        {Row}
      </VirtualizedList>
    </div>
  );
};

export default VirtualizedOrderList;
