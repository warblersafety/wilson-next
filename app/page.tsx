import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.notice}>
        <h1>Wilson Next</h1>
        <p>
          Experiment scaffold only. Report intake and clinical use are not
          available in Slice 0.
        </p>
      </section>
    </main>
  );
}
