import classNames from 'classnames';
import React from 'react';
import { BrandLogo } from '@/components/Brand/BrandLogo';

import '@/style/components/BigcapitalLoading.scss';

interface BigcapitalLoadingProps {
  className?: string;
}

/**
 * Bigcapital logo loading.
 */
export default function BigcapitalLoading({
  className,
}: BigcapitalLoadingProps) {
  return (
    <div className={classNames('bigcapital-loading', className)}>
      <div className="center">
        <BrandLogo height={40} className="bigcapital-logo" />
      </div>
    </div>
  );
}
