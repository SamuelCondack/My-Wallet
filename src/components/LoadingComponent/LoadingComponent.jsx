import styles from "./LoadingComponent.module.scss";

function Loading() {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.spinner}></div>
      <p>Loading...</p>
    </div>
  );
}
export default Loading;
