import React from 'react';
import PaymentOptimizerCore from './PaymentOptimizerCore';
import PaymentOptimizerView from './PaymentOptimizerView';

const PaymentOptimizer = (props) => {
  return (
    <PaymentOptimizerCore {...props}>
      {(state) => <PaymentOptimizerView {...state} />}
    </PaymentOptimizerCore>
  );
};

export default PaymentOptimizer;