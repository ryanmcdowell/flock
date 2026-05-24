use crate::models::CheckIn;
use chrono::{Utc, TimeZone};
use std::collections::HashMap;

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct StreakResult {
    pub days: u32,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
}

pub fn longest_streak(timestamps: &[i64]) -> StreakResult {
    if timestamps.is_empty() {
        return StreakResult { days: 0, start_ts: None, end_ts: None };
    }
    let mut days: Vec<i64> = timestamps.iter().map(|ts| ts / 86400).collect();
    days.sort_unstable();
    days.dedup();

    let (mut max, mut curr) = (1u32, 1u32);
    let (mut max_start, mut max_end, mut curr_start) = (days[0], days[0], days[0]);

    for i in 1..days.len() {
        if days[i] == days[i-1] + 1 {
            curr += 1;
            if curr > max { max = curr; max_start = curr_start; max_end = days[i]; }
        } else {
            curr = 1; curr_start = days[i];
        }
    }
    StreakResult { days: max, start_ts: Some(max_start * 86400), end_ts: Some(max_end * 86400) }
}

pub fn top_cities(checkins: &[CheckIn], limit: usize) -> Vec<(String, usize)> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for c in checkins {
        if let Some(city) = &c.venue_city {
            *counts.entry(city.clone()).or_insert(0) += 1;
        }
    }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| b.1.cmp(&a.1));
    pairs.truncate(limit);
    pairs
}

pub fn checkins_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for c in checkins { *counts.entry(fmt_month(c.checked_in_at)).or_insert(0) += 1; }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| a.0.cmp(&b.0));
    pairs
}

pub fn new_venues_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> {
    let mut sorted = checkins.to_vec();
    sorted.sort_by_key(|c| c.checked_in_at);
    let mut first: HashMap<String, String> = HashMap::new();
    for c in &sorted {
        if let Some(vid) = &c.venue_id {
            first.entry(vid.clone()).or_insert_with(|| fmt_month(c.checked_in_at));
        }
    }
    let mut counts: HashMap<String, usize> = HashMap::new();
    for month in first.values() { *counts.entry(month.clone()).or_insert(0) += 1; }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| a.0.cmp(&b.0));
    pairs
}

fn fmt_month(ts: i64) -> String {
    Utc.timestamp_opt(ts, 0).unwrap().format("%Y-%m").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> i64 {
        chrono::NaiveDate::from_ymd_opt(y, m, d).unwrap()
            .and_hms_opt(12, 0, 0).unwrap().and_utc().timestamp()
    }

    fn ci(id: &str, city: &str, vid: &str, ts: i64) -> CheckIn {
        CheckIn { id: id.into(), venue_id: Some(vid.into()), venue_name: "P".into(),
            venue_address: None, venue_city: Some(city.into()), venue_country: None,
            venue_category: None, lat: None, lng: None, checked_in_at: ts,
            note: None, swarm_url: None }
    }

    #[test]
    fn test_streak_consecutive() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,2), day(2024,1,3)]);
        assert_eq!(r.days, 3);
    }

    #[test]
    fn test_streak_with_gap() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,2), day(2024,1,5), day(2024,1,6)]);
        assert_eq!(r.days, 2);
    }

    #[test]
    fn test_streak_empty() {
        assert_eq!(longest_streak(&[]).days, 0);
    }

    #[test]
    fn test_streak_deduplicates_same_day() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,1)+3600, day(2024,1,2)]);
        assert_eq!(r.days, 2);
    }

    #[test]
    fn test_top_cities() {
        let checkins = vec![ci("1","SF","v1",1), ci("2","SF","v2",2), ci("3","NYC","v3",3)];
        let r = top_cities(&checkins, 2);
        assert_eq!(r[0], ("SF".into(), 2));
        assert_eq!(r[1], ("NYC".into(), 1));
    }

    #[test]
    fn test_new_venues_per_month() {
        let checkins = vec![
            ci("1","SF","v1",day(2024,1,5)),
            ci("2","SF","v1",day(2024,1,10)), // repeat v1 — doesn't count
            ci("3","SF","v2",day(2024,1,15)),
            ci("4","SF","v3",day(2024,2,10)),
        ];
        let r = new_venues_per_month(&checkins);
        let jan = r.iter().find(|(m,_)| m=="2024-01").map(|(_,n)| *n);
        let feb = r.iter().find(|(m,_)| m=="2024-02").map(|(_,n)| *n);
        assert_eq!(jan, Some(2));
        assert_eq!(feb, Some(1));
    }
}
