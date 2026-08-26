package kr.light.newcomer;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NewcomerRepository extends JpaRepository<NewcomerRequest, Long> {
}
