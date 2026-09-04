package kr.light.album;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlbumRepository extends JpaRepository<Album, Long> {

    /** 목록 — 행사일이 최근인 것부터 (SPEC_API.md §6.1) */
    Page<Album> findAllByOrderByEventDateDescIdDesc(Pageable pageable);
}
