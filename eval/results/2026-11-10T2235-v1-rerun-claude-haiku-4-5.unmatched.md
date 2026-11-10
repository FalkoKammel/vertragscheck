# Unmatched clauses

Clauses the model returned that overlap no label. Review by hand: each is either a missing label or a false positive.

## employment-04 · run 1 · non_compete · check

> Der Arbeitnehmer verpflichtet sich, für die Dauer von zwölf Monaten nach Beendigung des Arbeitsverhältnisses nicht für ein Unternehmen tätig zu werden, das im Bereich der Datenanalyse für Energieversorger mit dem Arbeitgeber in Wettbewerb steht.

Das Wettbewerbsverbot ist auf 12 Monate begrenzt und die Entschädigung beträgt 25 % des letzten Gehalts. Nach § 74 HGB ist eine Entschädigung von mindestens 50 % erforderlich. Die gezahlte Entschädigung von 25 % liegt unter dem gesetzlichen Minimum und macht das Verbot wahrscheinlich unwirksam.

## employment-04 · run 1 · compensation · check

> Der Arbeitnehmer kann zusätzlich eine variable Vergütung von bis zu 10 Prozent seines Jahresbruttogehalts erhalten. Die Ziele und deren Gewichtung werden in einer Zielvereinbarung festgelegt, die die Parteien jeweils bis zum 31. Januar eines Jahres abschließen.

Die variable Vergütung enthält einen Freiwilligkeitsvorbehalt ("kann") und die Ziele werden erst bis 31. Januar festgelegt. Es ist unklar, ob der Arbeitgeber die Zielvereinbarung verweigern kann oder wie die Vergütung berechnet wird, wenn keine Einigung zustande kommt.

## employment-04 · run 1 · working_time · fine

> Angeordnete Überstunden werden nach Wahl des Arbeitnehmers durch Freizeit ausgeglichen oder mit dem anteiligen Stundenlohn vergütet.

Die Regelung zu Überstunden ist angemessen: Der Arbeitnehmer hat die Wahl zwischen Freizeitausgleich oder Bezahlung, und es gibt keine pauschale Abgeltung ohne Grenzen.

## employment-04 · run 1 · vacation · fine

> Der Arbeitnehmer hat Anspruch auf 30 Arbeitstage Erholungsurlaub im Kalenderjahr bei einer Fünftagewoche.

Der Urlaubsanspruch von 30 Tagen bei einer 5-Tage-Woche liegt über dem gesetzlichen Minimum von 20 Tagen und ist für den Arbeitnehmer vorteilhaft.

## rental-03 · run 1 · term_termination · critical

> Beide Vertragsparteien verzichten wechselseitig für die Dauer von vier Jahren ab Vertragsschluss auf ihr Recht zur ordentlichen Kündigung.

Ein gegenseitiger Kündigungsverzicht über vier Jahre ist nach deutschem Mietrecht nicht zulässig. § 540 Abs. 2 BGB erlaubt einen Kündigungsverzicht nur für maximal vier Jahre, aber nur einseitig zugunsten des Vermieters. Ein gegenseitiger Verzicht benachteiligt den Mieter erheblich und ist likely invalid.

## rental-04 · run 1 · rent · check

> Die monatliche Nettokaltmiete beträgt bei Mietbeginn 1.150,00 Euro.

Die Anfangsmiete sollte überprüft werden, ob sie die Mietpreisbremse nach § 556d BGB einhält. Dies hängt davon ab, ob die Wohnung in einem Gebiet mit Mietpreisbremse liegt und ob die Miete die zulässige Obergrenze überschreitet.

## rental-04 · run 1 · minor_repairs · fine

> Die Kostentragung ist auf 90 Euro je Einzelreparatur und auf höchstens 6 Prozent der Jahresnettokaltmiete, jedoch nicht mehr als 300 Euro im Kalenderjahr begrenzt.

Die Regelung mit einer Obergrenze pro Einzelfall (90 Euro) und pro Jahr (300 Euro) entspricht den gesetzlichen Anforderungen und ist angemessen.

## rental-04 · run 1 · deposit · fine

> Die Mieterin ist berechtigt, die Sicherheit in drei gleichen monatlichen Teilzahlungen zu erbringen.

Die Möglichkeit, die Kaution in Raten zu zahlen, ist zulässig und entspricht den Anforderungen des § 551 Abs. 2 BGB.

## rental-04 · run 1 · term_termination · check

> Das Mietverhältnis beginnt am 1. Juni 2027 und läuft auf unbestimmte Zeit.

Das Mietverhältnis ist unbefristet, was grundsätzlich zulässig ist. Allerdings sollte überprüft werden, ob die Kündigungsfristen in § 3 angemessen sind und ob es versteckte Befristungen gibt.

## rental-04 · run 1 · use_subletting · fine

> Die Mieterin darf die Wohnung nur mit Erlaubnis der Vermieter ganz oder teilweise einem Dritten zum Gebrauch überlassen. Ein Anspruch auf Erlaubnis der Überlassung eines Teils der Wohnung besteht nach Maßgabe des § 553 BGB.

Die Regelung verbietet Untervermietung nicht pauschal, sondern macht sie von der Zustimmung der Vermieter abhängig und verweist auf den gesetzlichen Anspruch nach § 553 BGB. Dies ist zulässig.

## rental-04 · run 1 · alterations · fine

> Bauliche Veränderungen durch die Mieterin, insbesondere Um- und Einbauten sowie Installationen, bedürfen der vorherigen Zustimmung der Vermieter. Die Rechte der Mieterin nach § 554 BGB bleiben unberührt.

Die Regelung verweist auf die Rechte der Mieterin nach § 554 BGB und schränkt diese nicht ein. Dies ist angemessen.
