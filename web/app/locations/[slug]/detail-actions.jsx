"use client";

import styles from "./page.module.css";

export function DetailActions({ detailUrl, mapUrl }) {
  return (
    <div className={styles.actions}>
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className={styles.actionPrimary}
      >
        查看地图
      </a>
      {detailUrl ? (
        <a
          href={detailUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.actionSecondary}
        >
          查看官网详情
        </a>
      ) : null}
    </div>
  );
}
